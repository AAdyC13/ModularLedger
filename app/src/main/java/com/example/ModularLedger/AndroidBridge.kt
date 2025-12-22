package com.example.ModularLedger

import android.content.Context
import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import java.lang.ref.WeakReference
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * AndroidBridge - 升級版
 * * 職責：
 * 1. 提供同步方法供輕量級操作使用 (既有功能)
 * 2. 提供 postMessage 作為異步任務匯流排 (新增功能)
 * 3. 管理 CoroutineScope 以避免內存洩漏
 */
class AndroidBridge(
        private val context: Context,
        private val worker: BackgroundWorker,
        private val webViewRef: WeakReference<WebView>
// private val repository: LedgerRepository,
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
    //  Core: Asynchronous Task Bus (異步任務匯流排)
    // ============================================================================================

    /** 前端呼叫的單一異步入口 格式: { "taskId": "uuid", "action": "DB:query", "payload": {} } */
    @JavascriptInterface
    fun postMessage(jsonString: String) {
        // 切換到 IO 線程解析與分發，避免阻塞 Web 線程
        ioScope.launch {
            var taskId = "unknown"
            try {
                val request = JSONObject(jsonString)
                taskId = request.optString("taskId", "unknown")
                val action = request.optString("action")
                val payload = request.optJSONObject("payload") ?: JSONObject()

                // 路由分發 (Router)
                val resultData: Any? =
                        when {
                            action.startsWith("DB:") -> handleDatabaseAction(action, payload)
                            action.startsWith("SYS:") -> handleSystemAction(action, payload)
                            action == "TEST:ping" -> "pong" // 測試用
                            else -> throw IllegalArgumentException("Unknown action: $action")
                        }

                // 成功回傳
                sendResponse(taskId, "SUCCESS", resultData)
            } catch (e: Exception) {
                Log.e("AndroidBridge", "Task failed: $jsonString", e)
                // 失敗回傳
                sendResponse(taskId, "ERROR", null, e.message ?: "Unknown error")
            }
        }
    }

    private suspend fun handleDatabaseAction(action: String, payload: JSONObject): Any? {
        return when (action) {
            "DB:getAllExpenses" -> {
                true
            }
            else -> throw IllegalArgumentException("Unknown Database action: $action")
        }
    }
    // private fun mapExpensesToJson(transactions: List<OrchestratedTransaction>): JSONArray {
    //     val jsonArray = JSONArray()
    //     transactions.forEach {
    //         val expense = it.expense // Extract the core Expense object
    //         jsonArray.put(
    //                 JSONObject().apply {
    //                     put("id", expense.id)
    //                     put("amount", expense.amount)
    //                     put("description", expense.description)
    //                     put("timestamp", expense.timestamp)
    //                 }
    //         )
    //     }
    //     return jsonArray
    // }

    /** 系統操作路由 */
    private suspend fun handleSystemAction(action: String, payload: JSONObject): Any? {
        return when (action) {
            "SYS:getTechs" -> {
                val fileNames = payload.optJSONArray("fileNames") ?: JSONArray()
                val names = mutableListOf<String>()
                for (i in 0 until fileNames.length()) {
                    names.add(fileNames.optString(i))
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
                            Log.d("AndroidBridge", "Tech not found for module: $name")
                            techsMap[name] = JSONObject()
                        } catch (e: Exception) {
                            Log.w("AndroidBridge", "Cannot read tech for module: $name", e)
                            techsMap[name] = JSONObject()
                        }
                    }
                } catch (e: Exception) {
                    Log.e("AndroidBridge", "Error while loading techs", e)
                }
                JSONObject(techsMap as Map<*, *>)
            }
            "SYS:getSystemModulesList" -> JSONArray(worker.systemModulesList)
            "SYS:getSchema" -> {
                val name = payload.optString("name")
                worker.schemas[name] ?: JSONObject()
            }
            "SYS:getDeviceInfo" ->
                    JSONObject().apply {
                        put("brand", android.os.Build.BRAND)
                        put("model", android.os.Build.MODEL)
                        put("version", android.os.Build.VERSION.RELEASE)
                        put("sdk", android.os.Build.VERSION.SDK_INT)
                    }
            "SYS:getAppVersion" -> getAppVersion()
            "SYS:checkNetworkStatus" -> checkNetworkStatus()
            "SYS:requestPermission" -> {
                val permission = payload.optString("permission")
                requestPermission(permission)
            }
            "SYS:syncThemeColor" ->
                    withContext(Dispatchers.Main) { syncThemeColor(payload.optString("color")) }
            "SYS:openSettings" -> withContext(Dispatchers.Main) { openSettings() }
            "SYS:share" ->
                    withContext(Dispatchers.Main) {
                        share(payload.optString("text"), payload.optString("title"))
                    }
            else -> throw IllegalArgumentException("Unknown System action: $action")
        }
    }

    /** 將結果回傳給前端 JS */
    private fun sendResponse(
            taskId: String,
            status: String,
            data: Any?,
            errorMessage: String? = null
    ) {
        bridgeScope.launch {
            try {
                val response =
                        JSONObject().apply {
                            put("taskId", taskId)
                            put("status", status)
                            if (data != null) put("data", data)
                            if (errorMessage != null) {
                                put(
                                        "error",
                                        JSONObject().apply {
                                            put("code", 500)
                                            put("message", errorMessage)
                                        }
                                )
                            }
                        }

                // 呼叫前端定義的全域接收函數
                val script =
                        "if(window.BridgeMessenger) window.BridgeMessenger.onNativeMessage(${response.toString()})"
                webViewRef.get()?.evaluateJavascript(script, null)
            } catch (e: Exception) {
                Log.e("AndroidBridge", "Failed to send response", e)
            }
        }
    }

    // ============================================================================================
    //  Private Helpers for Actions
    // ============================================================================================

    private fun syncThemeColor(color: String) {
        (context as? MainActivity)?.runOnUiThread { context.updateThemeColor(color) }
    }

    private fun getAppVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    private fun checkNetworkStatus(): Boolean {
        val connectivityManager =
                context.getSystemService(Context.CONNECTIVITY_SERVICE) as
                        android.net.ConnectivityManager
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            // For older versions, this check might be different or not fully reliable.
            // Consider a fallback or defining a specific behavior.
            // Returning false as a safe default.
            false
        }
    }

    private fun openSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "無法打開設置", Toast.LENGTH_SHORT).show()
        }
    }

    private fun share(text: String, title: String) {
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

    private fun requestPermission(permission: String): Boolean {
        val result = androidx.core.content.ContextCompat.checkSelfPermission(context, permission)
        return result == android.content.pm.PackageManager.PERMISSION_GRANTED
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
            schemaFiles?.forEach { fileName ->
                if (fileName.endsWith(".json")) {
                    val schemaName = fileName.removeSuffix(".json")
                    val content =
                            assetManager.open("$schemasPath/$fileName").bufferedReader().use {
                                it.readText()
                            }
                    schemasMap[schemaName] = JSONObject(content)
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Cannot read schemas", e)
        }
        return schemasMap
    }

    private fun loadSystemModulesList(): List<Map<String, Any>> {
        val path = "www/systemModules"
        val modules = mutableListOf<Map<String, Any>>()
        try {
            val assetManager = context.assets
            val folderNames = assetManager.list(path)
            folderNames?.forEach { folderName ->
                val subItems = assetManager.list("$path/$folderName")
                if (subItems != null) {
                    try {
                        val infoPath = "$path/$folderName/info.json"
                        val jsonString =
                                assetManager.open(infoPath).bufferedReader().use { it.readText() }
                        val jsonObject = JSONObject(jsonString)
                        val moduleInfo = mutableMapOf<String, Any>()
                        jsonObject.keys().forEach { key -> moduleInfo[key] = jsonObject.get(key) }
                        moduleInfo["folderName"] = folderName
                        Log.d("BackgroundWorker", "Loaded module: $folderName")
                        modules.add(moduleInfo)
                    } catch (e: Exception) {
                        Log.w("BackgroundWorker", "Info.json error for: $folderName")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("BackgroundWorker", "Cannot read modules", e)
        }
        return modules
    }
}
