// app/src/main/java/com/example/modular_ledger/WebAppInterface.kt
package com.example.modular_ledger

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import com.example.modular_ledger.data.controller.RawSqlController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * 注入到 WebView 的 "Android" 物件，負責接收 JS 的呼叫。
 */
class WebAppInterface(
    private val context: Context,
    private val webView: WebView,
    private val rawSqlController: RawSqlController
) {
    // 定義 Coroutine Scope 以便在背景執行資料庫操作
    private val scope = CoroutineScope(Dispatchers.Main)
    private val TAG = "WebAppInterface"

    /**
     * 顯示 Toast (保留既有功能)
     */
    @JavascriptInterface
    fun showToast(messageJson: String) {
        try {
            val json = JSONObject(messageJson)
            val params = json.optJSONObject("params")
            val message = params?.optString("message") ?: ""
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 執行 SQL 指令 (INSERT, UPDATE, DELETE, CREATE)
     * 對應 JS: Android.execSQL(...)
     */
    @JavascriptInterface
    fun execSQL(messageJson: String) {
        Log.d(TAG, "收到 JS 請求 execSQL: $messageJson")
        processBridgeMessage(messageJson) { params ->
            val sql = params.getString("sql")
            val args = params.optJSONArray("args")
            val pluginId = params.optString("pluginId", "unknown")
            
            rawSqlController.execSQL(pluginId, sql, args)
            
            // 成功回傳空物件
            JSONObject()
        }
    }

    /**
     * 執行 SQL 查詢 (SELECT)
     * 對應 JS: Android.sqlQuery(...)
     */
    @JavascriptInterface
    fun sqlQuery(messageJson: String) {
        Log.d(TAG, "收到 JS 請求 sqlQuery: $messageJson")
        processBridgeMessage(messageJson) { params ->
            val sql = params.getString("sql")
            val args = params.optJSONArray("args")
            val pluginId = params.optString("pluginId", "unknown")

            val resultList = rawSqlController.rawQuery(pluginId, sql, args)
            
            // 將 List<Map> 轉回 JSON Array
            val jsonResult = JSONArray()
            for (row in resultList) {
                jsonResult.put(JSONObject(row))
            }
            jsonResult
        }
    }

    /**
     * 統一處理 Bridge 訊息：解析 JSON -> 切換 IO 執行緒 -> 回傳結果給 JS
     */
    private fun processBridgeMessage(messageJson: String, block: suspend (JSONObject) -> Any) {
        scope.launch {
            var callbackId = -1
            try {
                val json = JSONObject(messageJson)
                callbackId = json.optInt("id", -1)
                val params = json.optJSONObject("params") ?: JSONObject()

                // 在 IO 執行緒操作資料庫
                val resultData = withContext(Dispatchers.IO) {
                    block(params)
                }

                // 切回 UI 執行緒發送結果
                sendSuccess(callbackId, resultData)

            } catch (e: Exception) {
                e.printStackTrace()
                sendError(callbackId, e.message ?: "Unknown Error")
            }
        }
    }

    private fun sendSuccess(callbackId: Int, data: Any) {
        if (callbackId == -1) return
        val script = "window.handleAndroidCallback($callbackId, JSON.stringify($data))"
        webView.evaluateJavascript(script, null)
    }

    private fun sendError(callbackId: Int, errorMessage: String) {
        if (callbackId == -1) return
        val errorJson = JSONObject().put("error", errorMessage).toString()
        val script = "window.handleAndroidCallback($callbackId, '$errorJson')"
        webView.evaluateJavascript(script, null)
    }
}