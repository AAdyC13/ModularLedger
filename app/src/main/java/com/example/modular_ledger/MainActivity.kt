package com.example.modular_ledger

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.InternalStoragePathHandler
import com.example.modular_ledger.data.AppDatabase
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var database: AppDatabase

    companion object {
        // 在此設定商店伺服器位置
        private const val SERVER_URL = "http://163.18.26.227:3001"
        private const val LOCAL_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)

        val webView = WebView(this)

        // 初始化資料庫
        database = AppDatabase.getDatabase(this)

        // 建立 Worker 並預載資料
        val worker = BackgroundWorker(this)
        Executors.newSingleThreadExecutor().execute {
            worker.reloadModules(database.moduleDao())
        }

        // 設定 WebSettings
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE

        // 設定 AssetLoader：加入使用者模組路徑映射
        // 目標路徑：/data/user/0/.../files/www/userModules
        val userModulesDir = File(filesDir, "www/userModules")
        if (!userModulesDir.exists()) userModulesDir.mkdirs()

        assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
                // 讓前端可透過 https://appassets.androidplatform.net/user_modules/ 存取下載的檔案
                .addPathHandler("/user_modules/", InternalStoragePathHandler(this, userModulesDir))
                .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
            ): WebResourceResponse? {
                // 優先讓 AssetLoader 處理 (包含 assets 和 user_modules)
                val response = assetLoader.shouldInterceptRequest(request.url)
                if (response != null) {
                    return addSecurityHeaders(response)
                }

                val urlStr = request.url.toString()

                // 開放對 API 伺服器的連線
                if (urlStr.startsWith(SERVER_URL)) {
                    // 回傳 null 表示不攔截，讓 WebView 走正常的網路請求
                    return null
                }

                // 阻擋其他所有外部請求
                return WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        403,
                        "Forbidden",
                        null,
                        null
                )
            }

            override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
            ): Boolean {
                // 僅允許內部導航
                return false
            }
        }

        // 注入 Bridge (傳入 database)
        webView.addJavascriptInterface(AndroidBridge(this, worker, database), "AndroidBridge")
        
        setContentView(webView)
        webView.loadUrl(LOCAL_URL)
    }

    private fun addSecurityHeaders(orig: WebResourceResponse): WebResourceResponse {
        val mimeType = orig.mimeType ?: "text/plain"
        val encoding = orig.encoding ?: "utf-8"
        val inputStream = orig.data ?: ByteArrayInputStream(ByteArray(0))

        val headers = HashMap<String, String>()
        // CSP 設定：允許自身來源、API 伺服器
        headers["Content-Security-Policy"] = "default-src 'self' $SERVER_URL; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        headers["X-Frame-Options"] = "DENY"

        return WebResourceResponse(
                mimeType,
                encoding,
                200,
                "OK",
                headers,
                inputStream
        )
    }
}