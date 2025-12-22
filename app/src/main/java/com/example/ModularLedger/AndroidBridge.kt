package com.example.ModularLedger

import android.content.Context
import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import com.example.ModularLedger.data.AppDatabase
import com.example.ModularLedger.data.ModuleEntity
import com.example.ModularLedger.data.ModuleDao
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

class AndroidBridge(
    private val context: Context,
    private val worker: BackgroundWorker,
    private val webViewRef: WeakReference<WebView>,
    private val database: AppDatabase
) {
    private val bridgeScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val ioScope = CoroutineScope(Dispatchers.IO)

    fun destroy() {
        bridgeScope.cancel()
        ioScope.cancel()
    }

    @JavascriptInterface
    fun postMessage(jsonString: String) {
        ioScope.launch {
            var taskId = "unknown"
            try {
                val request = JSONObject(jsonString)
                taskId = request.optString("taskId", "unknown")
                val action = request.optString("action")
                val payload = request.optJSONObject("payload") ?: JSONObject()

                val resultData: Any? = when {
                    action.startsWith("DB:") -> handleDatabaseAction(action, payload)
                    action.startsWith("SYS:") -> handleSystemAction(action, payload)
                    action == "TEST:ping" -> "pong"
                    else -> throw IllegalArgumentException("Unknown action: $action")
                }
                sendResponse(taskId, "SUCCESS", resultData)
            } catch (e: Exception) {
                Log.e("AndroidBridge", "Task failed: $jsonString", e)
                sendResponse(taskId, "ERROR", null, e.message ?: "Unknown error")
            }
        }
    }

    // --- 相容舊版介面 (若有需要) ---
    @JavascriptInterface
    fun installModule(downloadUrl: String): String {
        return try {
            val success = runBlocking(Dispatchers.IO) { performInstall(downloadUrl) }
            if (success) {
                runBlocking(Dispatchers.IO) { worker.reloadModules(database.moduleDao()) }
                encodeResponse(mapOf("success" to true, "message" to "安裝成功"))
            } else {
                encodeResponse(mapOf("success" to false, "message" to "安裝失敗"))
            }
        } catch (e: Exception) {
            encodeResponse(mapOf("success" to false, "message" to (e.message ?: "Unknown Error")))
        }
    }

    private suspend fun handleDatabaseAction(action: String, payload: JSONObject): Any? {
        return when (action) {
            "DB:getAllExpenses" -> true 
            else -> throw IllegalArgumentException("Unknown Database action: $action")
        }
    }

    private suspend fun handleSystemAction(action: String, payload: JSONObject): Any? {
        return when (action) {
            "SYS:getTechs" -> {
                val fileNames = payload.optJSONArray("fileNames") ?: JSONArray()
                val names = mutableListOf<String>()
                for (i in 0 until fileNames.length()) {
                    names.add(fileNames.optString(i))
                }
                loadTechs(names)
            }
            "SYS:getSystemModulesList" -> {
                worker.reloadModules(database.moduleDao())
                JSONArray(worker.systemModulesList)
            }
            "SYS:installModule" -> {
                val url = payload.optString("url")
                if (url.isEmpty()) throw IllegalArgumentException("URL is required")
                val success = performInstall(url)
                if (success) worker.reloadModules(database.moduleDao())
                success
            }
            "SYS:toggleModule" -> {
                val id = payload.optString("id")
                val enable = payload.optBoolean("enable")
                database.moduleDao().updateModuleStatus(id, enable)
                worker.reloadModules(database.moduleDao())
                true
            }
            "SYS:getSchema" -> {
                val name = payload.optString("name")
                worker.schemas[name] ?: JSONObject()
            }
            // [新增] 支援 Toast 顯示
            "SYS:showToast" -> {
                val message = payload.optString("message")
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                }
                true
            }
            "SYS:getDeviceInfo" -> JSONObject().apply {
                put("brand", android.os.Build.BRAND)
                put("model", android.os.Build.MODEL)
                put("version", android.os.Build.VERSION.RELEASE)
                put("sdk", android.os.Build.VERSION.SDK_INT)
            }
            "SYS:getAppVersion" -> getAppVersion()
            "SYS:checkNetworkStatus" -> checkNetworkStatus()
            "SYS:requestPermission" -> requestPermission(payload.optString("permission"))
            "SYS:syncThemeColor" -> withContext(Dispatchers.Main) { syncThemeColor(payload.optString("color")) }
            "SYS:openSettings" -> withContext(Dispatchers.Main) { openSettings() }
            "SYS:share" -> withContext(Dispatchers.Main) { share(payload.optString("text"), payload.optString("title")) }
            else -> throw IllegalArgumentException("Unknown System action: $action")
        }
    }

    private fun loadTechs(names: List<String>): JSONObject {
        val techsMap = mutableMapOf<String, JSONObject>()
        val moduleMap = worker.systemModulesList.associateBy { it["folderName"] as? String ?: "" }

        for (name in names) {
            try {
                val modInfo = moduleMap[name]
                val isEnabled = modInfo?.get("isEnabled") as? Boolean ?: true
                
                if (!isEnabled) {
                    techsMap[name] = JSONObject()
                    continue
                }

                val sourceType = modInfo?.get("sourceType") as? String ?: "system"
                var content = ""

                if (sourceType == "user") {
                    val file = File(context.filesDir, "www/userModules/$name/tech.json")
                    if (file.exists()) content = file.readText()
                } else {
                    try {
                        val techPath = "www/systemModules/$name/tech.json"
                        val inputStream = context.assets.open(techPath)
                        content = inputStream.bufferedReader().use { it.readText() }
                    } catch (e: java.io.FileNotFoundException) {
                        Log.d("AndroidBridge", "Tech not found: $name")
                    }
                }

                if (content.isNotEmpty()) {
                    techsMap[name] = JSONObject(content)
                } else {
                    techsMap[name] = JSONObject()
                }
            } catch (e: Exception) {
                Log.w("AndroidBridge", "Error reading tech: $name", e)
                techsMap[name] = JSONObject()
            }
        }
        return JSONObject(techsMap as Map<*, *>)
    }

    private fun performInstall(urlString: String): Boolean {
        // [修正] 改為使用純 URL 物件，避免自動編碼問題
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 15000
        connection.readTimeout = 15000

        if (connection.responseCode != HttpURLConnection.HTTP_OK) throw Exception("Server error: ${connection.responseCode}")

        val tempFile = File(context.cacheDir, "temp_mod_${System.currentTimeMillis()}.zip")
        try {
            connection.inputStream.use { input ->
                FileOutputStream(tempFile).use { output -> input.copyTo(output) }
            }

            val tempExtractDir = File(context.cacheDir, "extract_${System.currentTimeMillis()}")
            tempExtractDir.mkdirs()

            try {
                unzipSecurely(tempFile, tempExtractDir)
                val infoFile = File(tempExtractDir, "info.json")
                if (!infoFile.exists()) throw Exception("info.json not found")

                val jsonObject = JSONObject(infoFile.readText())
                val modId = jsonObject.optString("id")
                if (modId.isEmpty()) throw Exception("Invalid Module ID")

                val userModulesDir = File(context.filesDir, "www/userModules")
                if (!userModulesDir.exists()) userModulesDir.mkdirs()

                val targetDir = File(userModulesDir, modId)
                if (targetDir.exists()) targetDir.deleteRecursively()

                if (!tempExtractDir.renameTo(targetDir)) {
                    tempExtractDir.copyRecursively(targetDir, overwrite = true)
                }

                // 寫入資料庫
                val entity = ModuleEntity(
                    id = modId,
                    name = jsonObject.optString("name", "Unknown"),
                    version = jsonObject.optString("version", "1.0.0"),
                    author = jsonObject.optString("author", "Unknown"),
                    description = jsonObject.optString("description", ""),
                    folderName = modId,
                    sourceType = "user",
                    isEnabled = true 
                )
                database.moduleDao().insertModule(entity)
                return true
            } finally {
                if (tempExtractDir.exists()) tempExtractDir.deleteRecursively()
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Install Error", e)
            return false
        } finally {
            if (tempFile.exists()) tempFile.delete()
        }
    }

    private fun unzipSecurely(zipFile: File, targetDir: File) {
        val canonicalTarget = targetDir.canonicalPath
        ZipInputStream(BufferedInputStream(zipFile.inputStream())).use { zis ->
            var entry: ZipEntry?
            while (zis.nextEntry.also { entry = it } != null) {
                val newFile = File(targetDir, entry!!.name)
                if (!newFile.canonicalPath.startsWith(canonicalTarget + File.separator)) {
                    throw SecurityException("Zip Slip violation")
                }
                if (entry!!.isDirectory) {
                    newFile.mkdirs()
                } else {
                    newFile.parentFile?.mkdirs()
                    FileOutputStream(newFile).use { fos -> zis.copyTo(fos) }
                }
            }
        }
    }

    private fun sendResponse(taskId: String, status: String, data: Any?, errorMessage: String? = null) {
        bridgeScope.launch {
            try {
                val response = JSONObject().apply {
                    put("taskId", taskId)
                    put("status", status)
                    if (data != null) put("data", data)
                    if (errorMessage != null) put("error", JSONObject().put("message", errorMessage))
                }
                val script = "if(window.BridgeMessenger) window.BridgeMessenger.onNativeMessage(${response.toString()})"
                webViewRef.get()?.evaluateJavascript(script, null)
            } catch (e: Exception) { Log.e("AndroidBridge", "Send response failed", e) }
        }
    }

    private fun encodeResponse(content: Any): String {
        return JSONObject().put("content", content).toString()
    }

    private fun getAppVersion() = try { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "" } catch (e: Exception) { "" }
    private fun checkNetworkStatus(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        return cm.activeNetwork?.let { cm.getNetworkCapabilities(it)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) } ?: false
    }
    private fun requestPermission(p: String) = androidx.core.content.ContextCompat.checkSelfPermission(context, p) == android.content.pm.PackageManager.PERMISSION_GRANTED
    private fun syncThemeColor(c: String) { (context as? MainActivity)?.runOnUiThread { context.updateThemeColor(c) } }
    private fun openSettings() { context.startActivity(Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    private fun share(text: String, title: String) { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type="text/plain"; putExtra(Intent.EXTRA_TEXT, text); putExtra(Intent.EXTRA_TITLE, title) }, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

class BackgroundWorker(private val context: Context) {
    var systemModulesList: List<Map<String, Any>> = ArrayList()
    val schemas: Map<String, JSONObject> = loadSchemas()

    fun reloadModules(moduleDao: ModuleDao) {
        val modules = mutableListOf<Map<String, Any>>()
        
        loadAssetsModules().forEach { 
            val m = it.toMutableMap()
            m["isEnabled"] = true
            modules.add(m)
        }

        try {
            moduleDao.getAllModulesSync().forEach { entity ->
                modules.add(mapOf(
                    "id" to entity.id,
                    "name" to entity.name,
                    "version" to entity.version,
                    "author" to entity.author,
                    "description" to entity.description,
                    "folderName" to entity.folderName,
                    "sourceType" to "user",
                    "isEnabled" to entity.isEnabled
                ))
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "DB Load Error", e)
        }
        systemModulesList = modules
    }

    private fun loadAssetsModules(): List<Map<String, Any>> {
        val list = mutableListOf<Map<String, Any>>()
        try {
            context.assets.list("www/systemModules")?.forEach { folder ->
                try {
                    val content = context.assets.open("www/systemModules/$folder/info.json").bufferedReader().use { it.readText() }
                    val json = JSONObject(content)
                    val map = mutableMapOf<String, Any>()
                    json.keys().forEach { map[it] = json.get(it) }
                    map["folderName"] = folder
                    map["sourceType"] = "system"
                    list.add(map)
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
        return list
    }

    private fun loadSchemas(): Map<String, JSONObject> {
        val map = mutableMapOf<String, JSONObject>()
        try {
            context.assets.list("schemas")?.forEach { file ->
                if (file.endsWith(".json")) {
                    val content = context.assets.open("schemas/$file").bufferedReader().use { it.readText() }
                    map[file.removeSuffix(".json")] = JSONObject(content)
                }
            }
        } catch (e: Exception) {}
        return map
    }
}