package com.example.modular_ledger

import android.content.Context
import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.example.modular_ledger.data.AppDatabase
import com.example.modular_ledger.data.ModuleEntity
import com.example.modular_ledger.data.ModuleDao
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

class AndroidBridge(
    private val context: Context,
    private val worker: BackgroundWorker,
    private val database: AppDatabase // 新增 DB 依賴
) {

    @JavascriptInterface
    fun getSystemModulesList(): String {
        // 每次獲取前先確保列表是最新的
        worker.reloadModules(database.moduleDao())
        return encodeResponse(worker.systemModulesList)
    }

    /**
     * 下載並安裝模組
     * 包含 Zip Slip 防護、DAO 寫入
     */
    @JavascriptInterface
    fun installModule(downloadUrl: String): String {
        return try {
            // 在背景執行緒執行網路與 IO 操作
            val success = performInstall(downloadUrl)

            if (success) {
                // 安裝成功後，立即更新快取
                worker.reloadModules(database.moduleDao())
                encodeResponse(mapOf("success" to true, "message" to "安裝成功"))
            } else {
                encodeResponse(mapOf("success" to false, "message" to "安裝過程發生未知錯誤"))
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Install Error", e)
            encodeResponse(mapOf("success" to false, "message" to (e.message ?: "Unknown Error")))
        }
    }

    /**
     * 執行安裝的詳細邏輯
     */
    private fun performInstall(urlString: String): Boolean {
        val url = URL(urlString)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 15000
        connection.readTimeout = 15000

        if (connection.responseCode != HttpURLConnection.HTTP_OK) {
            throw Exception("Server connection failed: ${connection.responseCode}")
        }

        // 下載至暫存檔
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
                // 安全解壓縮 (Zip Slip 防護)
                unzipSecurely(tempFile, tempExtractDir)

                // 讀取與驗證 info.json
                val infoFile = File(tempExtractDir, "info.json")
                if (!infoFile.exists()) throw Exception("Invalid Module: info.json not found")

                val jsonString = infoFile.readText()
                val jsonObject = JSONObject(jsonString)
                val modId = jsonObject.optString("id")

                if (modId.isEmpty()) throw Exception("Invalid Module: ID is missing")

                // 移動至正式目錄 (filesDir/www/userModules/{id})
                val userModulesDir = File(context.filesDir, "www/userModules")
                if (!userModulesDir.exists()) userModulesDir.mkdirs()

                val targetDir = File(userModulesDir, modId)

                // 如果舊版存在，先清理
                if (targetDir.exists()) targetDir.deleteRecursively()

                // 移動檔案
                if (!tempExtractDir.renameTo(targetDir)) {
                    // 如果 rename 失敗 (例如跨分區)，改用 copy + delete
                    tempExtractDir.copyRecursively(targetDir, overwrite = true)
                }

                // 5. 寫入 DAO (資料庫正規化)
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

    /**
     * 防止 Zip Slip 攻擊的解壓縮邏輯
     */
    private fun unzipSecurely(zipFile: File, targetDir: File) {
        val canonicalTarget = targetDir.canonicalPath

        ZipInputStream(BufferedInputStream(zipFile.inputStream())).use { zis ->
            var entry: ZipEntry?
            while (zis.nextEntry.also { entry = it } != null) {
                val newFile = File(targetDir, entry!!.name)
                val canonicalDest = newFile.canonicalPath

                // 檢查解壓路徑是否逃逸出目標目錄
                if (!canonicalDest.startsWith(canonicalTarget + File.separator)) {
                    throw SecurityException("Security Violation: Zip Slip attack detected! Path: ${entry!!.name}")
                }

                if (entry!!.isDirectory) {
                    newFile.mkdirs()
                } else {
                    newFile.parentFile?.mkdirs()
                    FileOutputStream(newFile).use { fos ->
                        zis.copyTo(fos)
                    }
                }
            }
        }
    }

    @JavascriptInterface
    fun getSchema(name: String): String {
        val schema = worker.schemas[name] ?: JSONObject()
        return encodeResponse(schema)
    }

    @JavascriptInterface
    fun getTechs(fileNamesJson: String): String {
        val decoded = decodeRequest(fileNamesJson)
        val names = mutableListOf<String>()

        when (decoded) {
            is JSONArray -> {
                for (i in 0 until decoded.length()) {
                    names.add(decoded.optString(i))
                }
            }
            is List<*> -> {
                decoded.forEach { if (it != null) names.add(it.toString()) }
            }
        }

        val techsMap = mutableMapOf<String, JSONObject>()
        
        // 建立資料夾名稱到模組資訊的映射，以便查詢 sourceType
        val moduleMap = worker.systemModulesList.associateBy { it["folderName"] as? String ?: "" }

        for (name in names) {
            try {
                val modInfo = moduleMap[name]
                val sourceType = modInfo?.get("sourceType") as? String ?: "system"
                var content = ""

                if (sourceType == "user") {
                    // 從使用者目錄讀取
                    val file = File(context.filesDir, "www/userModules/$name/tech.json")
                    if (file.exists()) {
                        content = file.readText()
                    }
                } else {
                    // 從 Assets 讀取
                    try {
                        val techPath = "www/systemModules/$name/tech.json"
                        val inputStream = context.assets.open(techPath)
                        content = inputStream.bufferedReader().use { it.readText() }
                    } catch (e: java.io.FileNotFoundException) {
                        Log.d("AndroidBridge", "Tech not found in assets for: $name")
                    }
                }

                if (content.isNotEmpty()) {
                    techsMap[name] = JSONObject(content)
                } else {
                    techsMap[name] = JSONObject()
                }

            } catch (e: Exception) {
                Log.w("AndroidBridge", "Error reading tech for module: $name", e)
                techsMap[name] = JSONObject()
            }
        }

        return encodeResponse(techsMap)
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val info = JSONObject().apply {
            put("brand", android.os.Build.BRAND)
            put("model", android.os.Build.MODEL)
            put("version", android.os.Build.VERSION.RELEASE)
            put("sdk", android.os.Build.VERSION.SDK_INT)
        }
        return encodeResponse(info)
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    @JavascriptInterface
    fun checkNetworkStatus(): Boolean {
        val connectivityManager =
                context.getSystemService(Context.CONNECTIVITY_SERVICE) as
                        android.net.ConnectivityManager
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            throw Exception("API level too low")
        }
    }

    @JavascriptInterface
    fun openSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "無法打開設置", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun share(text: String, title: String) {
        try {
            val shareIntent =
                    Intent(Intent.ACTION_SEND).apply {
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

    @JavascriptInterface
    fun exitApp() {
        if (context is android.app.Activity) {
            context.finish()
        }
    }

    @JavascriptInterface
    fun requestPermission(permission: String): Boolean {
        val result = androidx.core.content.ContextCompat.checkSelfPermission(context, permission)
        return result == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun encodeResponse(content: Any): String {
        val (type, jsonContent) =
                when (content) {
                    is JSONObject -> "Object" to content
                    is JSONArray -> "Array" to content
                    is List<*> -> "Array" to org.json.JSONArray(content)
                    is Map<*, *> -> "Object" to JSONObject(content)
                    else ->
                            throw IllegalArgumentException(
                                    "encodeResponse only for complex types. Use direct return for primitives."
                            )
                }

        return JSONObject()
                .apply {
                    put("type", type)
                    put("content", jsonContent)
                }
                .toString()
    }

    private fun decodeRequest(jsonString: String): Any? {
        return try {
            val json = JSONObject(jsonString)
            if (json.has("type") && json.has("content")) {
                json.get("content")
            } else {
                Log.w("AndroidBridge", "Invalid request format: $jsonString")
                null
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Error decoding request: $jsonString", e)
            null
        }
    }
}

class BackgroundWorker(private val context: Context) {
    // 改為可變列表，初始為空，等待 reloadModules 填充
    var systemModulesList: List<Map<String, Any>> = ArrayList()
    val schemas: Map<String, JSONObject> = loadSchemas()

    /**
     * 重新載入模組 (合併 System Assets 與 User DB)
     */
    fun reloadModules(moduleDao: ModuleDao) {
        val modules = mutableListOf<Map<String, Any>>()

        // 載入內建 System Modules (Assets)
        modules.addAll(loadAssetsModules())

        // 載入使用者模組 (從資料庫)
        try {
            val userModules = moduleDao.getAllModulesSync()
            userModules.forEach { entity ->
                modules.add(mapOf(
                    "id" to entity.id,
                    "name" to entity.name,
                    "version" to entity.version,
                    "author" to entity.author,
                    "description" to entity.description,
                    "folderName" to entity.folderName,
                    "sourceType" to "user" // 重要標記：供前端判斷讀取路徑
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

            if (folderNames != null) {
                folderNames.forEach { folderName ->
                    try {
                        // 檢查是否為資料夾 (透過嘗試讀取子內容)
                        val subItems = assetManager.list("$path/$folderName")
                        if (subItems != null) {
                            val stream = assetManager.open("$path/$folderName/info.json")
                            val jsonString = stream.bufferedReader().use { it.readText() }
                            val jsonObject = JSONObject(jsonString)
                            val map = mutableMapOf<String, Any>()
                            jsonObject.keys().forEach { key ->
                                map[key] = jsonObject.get(key)
                            }
                            map["folderName"] = folderName
                            map["sourceType"] = "system" // 標記為系統模組
                            list.add(map)
                        }
                    } catch (e: Exception) {
                        // 忽略非模組資料夾或無 info.json 的項目
                    }
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
            if (schemaFiles != null) {
                schemaFiles.forEach { fileName ->
                    try {
                        if (fileName.endsWith(".json")) {
                            val inputStream = assetManager.open("$schemasPath/$fileName")
                            val content = inputStream.bufferedReader().use { it.readText() }
                            schemasMap[fileName.removeSuffix(".json")] = JSONObject(content)
                        }
                    } catch (e: Exception) {
                        Log.w("BackgroundWorker", "Cannot read schema: $fileName", e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Cannot read schemas directory", e)
        }
        return schemasMap
    }
}