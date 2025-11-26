package com.example.modular_ledger

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

class AndroidBridge(private val context: Context) {

    @JavascriptInterface
    fun getTestJson(): String {
        val json =
                JSONObject().apply {
                    put("one", JSONArray(listOf("aaa")))
                    put("two", JSONArray(listOf(111)))
                    put("three", JSONObject().apply { put("key", "value") })
                }
        return json.toString()
    }

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
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
        return info.toString()
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

    @JavascriptInterface
    fun openExternalBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "無法打開瀏覽器", Toast.LENGTH_SHORT).show()
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
        // 注意：實際權限請求需要在 Activity 中處理，這裡僅檢查狀態
        val result = androidx.core.content.ContextCompat.checkSelfPermission(context, permission)
        return result == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun getSystemModulesManifest(): String {
        val path = "www/systemModules/systemModules.json"
        var modules = "[]"
        // 分離 try/catch，方便在除錯時設定斷點與檢視中間值
        try {
            context.assets.open(path).use { input -> modules = input.bufferedReader().readText() }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Cannot read $path", e)
        }
        Log.d("AndroidBridge", "SystemModulesManifest: $modules")
        return modules
    }
}
