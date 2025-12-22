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

/**
 * 結合了 Main 分支的異步匯流排架構與 Store 分支的模組管理功能。
 */
class AndroidBridge(
    private val context: Context,
    private val worker: BackgroundWorker,
    private val webViewRef: WeakReference<WebView>,
    private val database: AppDatabase // 新增：資料庫依賴
) {
    // 定義 Bridge 的協程作用域 (使用 Main + Job)
    private val bridgeScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // 定義 IO 作用域供繁重任務使用
    private val ioScope = CoroutineScope(Dispatchers.IO)

    /** 清理資源 (建議在 Activity onDestroy 時調用) */
    fun destroy() {
        bridgeScope.cancel()
        ioScope.cancel()
    }

    // ============================================================================================
    //  Core: Asynchronous Task Bus (異步任務匯流排 - Main 分支核心)
    // ============================================================================================

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

    // ============================================================================================
    //  Store Features: Direct Methods (相容 Store 前端)
    // ============================================================================================

    /**
     * 下載並安裝模組 (來自 Store 分支)
     * 包含 Zip Slip 防護、DAO 寫入
     */
    @JavascriptInterface
    fun installModule(downloadUrl: String): String {
        return try {
            // 在背景執行緒執行網路與 IO 操作，這裡使用 runBlocking 因為此介面定義為同步回傳 String
            // 建議前端改用 postMessage(SYS:installModule)，但為了相容性保留此方法
            val success = runBlocking(Dispatchers.IO) {
                performInstall(downloadUrl)
            }

            if (success) {
                // 安裝成功後，立即更新快取
                runBlocking(Dispatchers.IO) {
                    worker.reloadModules(database.moduleDao())
                }
                encodeResponse(mapOf("success" to true, "message" to "安裝成功"))
            } else {
                encodeResponse(mapOf("success" to false, "message" to "安裝過程發生未知錯誤"))
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Install Error", e)
            encodeResponse(mapOf("success" to false, "message" to (e.message ?: "Unknown Error")))
        }
    }

    @JavascriptInterface
    fun getSystemModulesList(): String {
        // 確保列表是最新的 (同步等待)
        runBlocking(Dispatchers.IO) {
            worker.reloadModules(database.moduleDao())
        }
        return encodeResponse(worker.systemModulesList)
    }

    // ============================================================================================
    //  Action Handlers
    // ============================================================================================

    private suspend fun handleDatabaseAction(action: String, payload: JSONObject): Any? {
        return when (action) {
            "DB:getAllExpenses" -> true
            // 可在此擴充更多 DB 操作
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
                // 支援透過 postMessage 呼叫安裝
                val url = payload.optString("url")
                if (url.isEmpty()) throw IllegalArgumentException("URL is required")
                val success = performInstall(url)
                if (success) worker.reloadModules(database.moduleDao())
                success
            }
            "SYS:getSchema" -> {
                val name = payload.optString("name")
                worker.schemas[name] ?: JSONObject()
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

    // ============================================================================================
    //  Installation Logic (移植自 Store 分支 Interface.kt)
    // ============================================================================================

    private fun performInstall(urlString: String): Boolean {
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 15000
        connection.readTimeout = 15000

        if (connection.responseCode != HttpURLConnection.HTTP_OK) {
            throw Exception("Server connection failed: ${connection.responseCode}")
        }

        val tempFile = File(context.cacheDir, "temp_module_${System.currentTimeMillis()}.zip")
        try {
            connection.inputStream.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            }

            val tempExtractDir = File(context.cacheDir, "extract_${System.currentTimeMillis()}")
            tempExtractDir.mkdirs()

            try {
                unzipSecurely(tempFile, tempExtractDir)

                val infoFile = File(tempExtractDir, "info.json")
                if (!infoFile.exists()) throw Exception("Invalid Module: info.json not found")

                val jsonString = infoFile.readText()
                val jsonObject = JSONObject(jsonString)
                val modId = jsonObject.optString("id")

                if (modId.isEmpty()) throw Exception("Invalid Module: ID is missing")

                val userModulesDir = File(context.filesDir, "www/userModules")
                if (!userModulesDir.exists()) userModulesDir.mkdirs()

                val targetDir = File(userModulesDir, modId)
                if (targetDir.exists()) targetDir.deleteRecursively()

                if (!tempExtractDir.renameTo(targetDir)) {
                    tempExtractDir.copyRecursively(targetDir, overwrite = true)
                }

                // 寫入 DAO
                val entity = ModuleEntity(
                    id = modId,
                    name = jsonObject.optString("name", "Unknown"),
                    version = jsonObject.optString("version", "1.0.0"),
                    author = jsonObject.optString("author", "Unknown"),
                    description = jsonObject.optString("description", ""),
                    folderName = modId,
                    sourceType = "user"
                )
                database.moduleDao().insertModule(entity)

                return true

            } finally {
                if (tempExtractDir.exists()) tempExtractDir.deleteRecursively()
            }
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
                val canonicalDest = newFile.canonicalPath

                if (!canonicalDest.startsWith(canonicalTarget + File.separator)) {
                    throw SecurityException("Security Violation: Zip Slip attack detected!")
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

    /** 讀取 Tech 設定 (支援系統與使用者模組) */
    private fun loadTechs(names: List<String>): JSONObject {
        val techsMap = mutableMapOf<String, JSONObject>()
        // 建立 ID -> ModuleInfo 映射
        val moduleMap = worker.systemModulesList.associateBy { it["folderName"] as? String ?: "" }

        for (name in names) {
            try {
                val modInfo = moduleMap[name]
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
                        Log.d("AndroidBridge", "Tech not found in assets: $name")
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

    // ============================================================================================
    //  Helpers
    // ============================================================================================

    private fun sendResponse(taskId: String, status: String, data: Any?, errorMessage: String? = null) {
        bridgeScope.launch {
            try {
                val response = JSONObject().apply {
                    put("taskId", taskId)
                    put("status", status)
                    if (data != null) put("data", data)
                    if (errorMessage != null) {
                        put("error", JSONObject().apply {
                            put("code", 500)
                            put("message", errorMessage)
                        })
                    }
                }
                val script = "if(window.BridgeMessenger) window.BridgeMessenger.onNativeMessage(${response.toString()})"
                webViewRef.get()?.evaluateJavascript(script, null)
            } catch (e: Exception) {
                Log.e("AndroidBridge", "Failed to send response", e)
            }
        }
    }

    private fun encodeResponse(content: Any): String {
        val (type, jsonContent) = when (content) {
            is JSONObject -> "Object" to content
            is JSONArray -> "Array" to content
            is List<*> -> "Array" to JSONArray(content)
            is Map<*, *> -> "Object" to JSONObject(content)
            else -> throw IllegalArgumentException("Unsupported type")
        }
        return JSONObject().apply {
            put("type", type)
            put("content", jsonContent)
        }.toString()
    }

    private fun syncThemeColor(color: String) {
        (context as? MainActivity)?.runOnUiThread { context.updateThemeColor(color) }
    }

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
        } catch (e: Exception) { "unknown" }
    }

    private fun checkNetworkStatus(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun openSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "無法打開設置", Toast.LENGTH_SHORT).show()
        }
    }

    private fun share(text: String, title: String) {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
                putExtra(Intent.EXTRA_TITLE, title)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(Intent.createChooser(shareIntent, title))
        } catch (e: Exception) {
            Toast.makeText(context, "分享失敗", Toast.LENGTH_SHORT).show()
        }
    }

    private fun requestPermission(permission: String): Boolean {
        val result = androidx.core.content.ContextCompat.checkSelfPermission(context, permission)
        return result == android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}

/**
 * BackgroundWorker - 整合版
 * 負責載入與管理系統內建模組 (Assets) 與使用者安裝模組 (DB)。
 */
class BackgroundWorker(private val context: Context) {
    // 改為可變列表，初始為空，等待 reloadModules 填充
    var systemModulesList: List<Map<String, Any>> = ArrayList()
    val schemas: Map<String, JSONObject> = loadSchemas()

    /**
     * 重新載入模組 (合併 System Assets 與 User DB)
     * 此方法應在 IO 線程呼叫
     */
    fun reloadModules(moduleDao: ModuleDao) {
        val modules = mutableListOf<Map<String, Any>>()

        // 1. 載入內建 System Modules (Assets)
        modules.addAll(loadAssetsModules())

        // 2. 載入使用者模組 (從資料庫)
        try {
            val userModules = moduleDao.getAllModulesSync() // 假設 DAO 有這個同步方法
            userModules.forEach { entity ->
                modules.add(mapOf(
                    "id" to entity.id,
                    "name" to entity.name,
                    "version" to entity.version,
                    "author" to entity.author,
                    "description" to entity.description,
                    "folderName" to entity.folderName,
                    "sourceType" to "user" // 重要：標記為使用者模組
                ))
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Failed to load modules from DB", e)
        }
        systemModulesList = modules
    }

    private fun loadAssetsModules(): List<Map<String, Any>> {
        val list = mutableListOf<Map<String, Any>>()
        val path = "www/systemModules"
        try {
            val assetManager = context.assets
            val folderNames = assetManager.list(path)

            folderNames?.forEach { folderName ->
                try {
                    // 檢查是否有 info.json
                    val stream = assetManager.open("$path/$folderName/info.json")
                    val jsonString = stream.bufferedReader().use { it.readText() }
                    val jsonObject = JSONObject(jsonString)
                    val map = mutableMapOf<String, Any>()
                    jsonObject.keys().forEach { key ->
                        map[key] = jsonObject.get(key)
                    }
                    map["folderName"] = folderName
                    map["sourceType"] = "system" // 重要：標記為系統模組
                    list.add(map)
                } catch (e: Exception) {
                    // 忽略非模組資料夾
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Error loading assets modules", e)
        }
        return list
    }

    private fun loadSchemas(): Map<String, JSONObject> {
        val schemasPath = "schemas"
        val schemasMap = mutableMapOf<String, JSONObject>()
        try {
            val assetManager = context.assets
            val schemaFiles = assetManager.list(schemasPath)
            schemaFiles?.forEach { fileName ->
                if (fileName.endsWith(".json")) {
                    val schemaName = fileName.removeSuffix(".json")
                    val content = assetManager.open("$schemasPath/$fileName").bufferedReader().use { it.readText() }
                    schemasMap[schemaName] = JSONObject(content)
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Cannot read schemas", e)
        }
        return schemasMap
    }
}