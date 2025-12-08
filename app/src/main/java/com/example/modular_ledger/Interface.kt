package com.example.modular_ledger

import android.content.Context
import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

class AndroidBridge(private val context: Context, private val worker: BackgroundWorker) {

    @JavascriptInterface
    fun getSystemModulesList(): String {
        return encodeResponse(worker.systemModulesList)
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
        val basePath = "www/systemModules"
        try {
            val assetManager = context.assets
            for (name in names) {
                try {
                    val techPath = "$basePath/$name/tech.json"
                    val inputStream = assetManager.open(techPath)
                    val content = inputStream.bufferedReader().use { it.readText() }
                    techsMap[name] = JSONObject(content)
                } catch (e: java.io.FileNotFoundException) {
                    // tech.json 不存在：表示此模組沒有 tech 定義，記錄為警告
                    Log.d("AndroidBridge", "Tech not found for module: $name")
                    techsMap[name] = JSONObject()
                } catch (e: Exception) {
                    // 其他錯誤：記錄例外與回傳空物件
                    Log.w("AndroidBridge", "Cannot read tech for module: $name", e)
                    techsMap[name] = JSONObject()
                }
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Error while loading techs", e)
        }

        return encodeResponse(techsMap)
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val info =
                JSONObject().apply {
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
            // val activeNetwork = connectivityManager.activeNetworkInfo
            // activeNetwork?.isConnected == true
            throw Exception("API level too low")
        }
    }

    // @JavascriptInterface
    // fun openExternalBrowser(url: String) {
    //     try {
    //         val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    //         intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    //         context.startActivity(intent)
    //     } catch (e: Exception) {
    //         Toast.makeText(context, "無法打開瀏覽器", Toast.LENGTH_SHORT).show()
    //     }
    // }

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
        // 注意：實際權限請求需要在 Activity 中處理，這裡僅檢查狀態
        val result = androidx.core.content.ContextCompat.checkSelfPermission(context, permission)
        return result == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    /**
     * JSON 編碼器：將複雜資料包裝為 JSON 字串 只用於 Object/Array 等複雜類型，基本類型 (String/Number/Boolean) 不需使用
     * @param content 要包裝的內容 (JSONObject, JSONArray, List, Map)
     * @return JSON 字串: {"type":"類型", "content":內容}
     */
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
    /**
     * JSON 解碼器：解析前端傳來的複雜資料
     * @param jsonString 前端傳來的 JSON 字串
     * @return 解析後的 content，失敗返回 null
     */
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
    val systemModulesList: List<Map<String, Any>> =
            loadSystemModulesList().ifEmpty { listOf(mapOf("id" to "default")) }
    val schemas: Map<String, JSONObject> =
            loadSchemas().ifEmpty { mapOf("default" to JSONObject()) }

    private fun loadSchemas(): Map<String, JSONObject> {
        val schemasPath = "schemas"
        val schemasMap = mutableMapOf<String, JSONObject>()

        try {
            val assetManager = context.assets
            val schemaFiles = assetManager.list(schemasPath)

            if (schemaFiles != null && schemaFiles.isNotEmpty()) {
                schemaFiles.forEach { fileName ->
                    try {
                        if (fileName.endsWith(".json")) {
                            val schemaPath = "$schemasPath/$fileName"
                            val inputStream = assetManager.open(schemaPath)
                            val schemaContent = inputStream.bufferedReader().use { it.readText() }
                            // 使用檔名作為 key (移除 .json 後綴)
                            val schemaName = fileName.removeSuffix(".json")
                            val jsonObj = JSONObject(schemaContent)
                            schemasMap[schemaName] = jsonObj
                            // Log.d("BackgroundWorker", "Loaded schema: $schemaName")
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

    private fun loadSystemModulesList(): List<Map<String, Any>> {
        val path = "www/systemModules"
        val modules = mutableListOf<Map<String, Any>>()

        try {
            val assetManager = context.assets
            val folderNames = assetManager.list(path)

            if (folderNames != null && folderNames.isNotEmpty()) {
                folderNames.forEach { folderName ->
                    try {
                        // 檢查是否為資料夾
                        val subItems = assetManager.list("$path/$folderName")
                        if (subItems != null) {
                            // 讀取 info.json
                            val infoPath = "$path/$folderName/info.json"
                            val inputStream = assetManager.open(infoPath)
                            val jsonString = inputStream.bufferedReader().use { it.readText() }

                            // 解析 JSON
                            val jsonObject = JSONObject(jsonString)

                            // 轉換為 Map
                            val moduleInfo = mutableMapOf<String, Any>()
                            jsonObject.keys().forEach { key ->
                                moduleInfo[key] = jsonObject.get(key)
                                moduleInfo["folderName"] = folderName
                            }
                            modules.add(moduleInfo)
                            Log.d("BackgroundWorker", "Loaded module.info ID: ${moduleInfo["id"]}")
                        }
                    } catch (e: Exception) {
                        Log.w(
                                "BackgroundWorker",
                                "Cannot read info.json for module: $folderName",
                                e
                        )
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Cannot read $path", e)
        }

        return modules
    }
}
