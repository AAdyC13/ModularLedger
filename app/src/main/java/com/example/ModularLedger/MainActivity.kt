package com.example.ModularLedger

import android.graphics.Color
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.InternalStoragePathHandler
import android.webkit.WebSettings
import com.example.ModularLedger.data.AppDatabase
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var rootLayout: FrameLayout
    private lateinit var database: AppDatabase

    companion object {
        // 商店 API 伺服器 (依需求調整 IP)
        private const val SERVER_URL = "http://163.18.26.227:3001"
        // 前端入口
        private const val LOCAL_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)

        // --- UI 初始化 (Main 分支邏輯) ---
        val webView = WebView(this)
        rootLayout = FrameLayout(this)
        rootLayout.addView(webView)
        
        // 設定主題顏色
        updateThemeColor("#2e5773")

        // --- 核心功能初始化 (Store 分支邏輯) ---
        // 1. 初始化資料庫
        database = AppDatabase.getDatabase(this)

        // 2. 建立 Worker 並預載模組資料
        val worker = BackgroundWorker(this)
        Executors.newSingleThreadExecutor().execute {
            worker.reloadModules(database.moduleDao())
        }

        // --- WebView 設定 ---
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        // 若需連線 http 伺服器，需開啟 Mixed Content
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW 

        // --- AssetLoader 設定 (關鍵：加入 user_modules) ---
        val userModulesDir = File(filesDir, "www/userModules")
        if (!userModulesDir.exists()) userModulesDir.mkdirs()

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            // 讓前端可存取下載的模組：https://appassets.androidplatform.net/user_modules/
            .addPathHandler("/user_modules/", InternalStoragePathHandler(this, userModulesDir))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                // 1. 優先讓 AssetLoader 處理
                val response = assetLoader.shouldInterceptRequest(request.url)
                if (response != null) {
                    return addSecurityHeaders(response)
                }

                val urlStr = request.url.toString()

                // 2. 開放對 API 伺服器的連線
                if (urlStr.startsWith(SERVER_URL)) {
                    return null // 走正常網路請求
                }

                // 3. 阻擋其他外部請求 (Main 分支邏輯)
                return WebResourceResponse(
                    "text/plain", "UTF-8", 403, "Forbidden", null, null
                )
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                return false // 僅允許內部導航
            }
        }

        // 處理視窗邊距 (Main 分支邏輯)
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        // --- 注入 Bridge ---
        // 需確保 AndroidBridge 建構子已更新為接收 (Context, Worker, WeakReference<WebView>, AppDatabase)
        webView.addJavascriptInterface(
            AndroidBridge(this, worker, java.lang.ref.WeakReference(webView), database),
            "AndroidBridge"
        )

        setContentView(rootLayout)
        webView.loadUrl(LOCAL_URL)
    }

    /**
     * 動態更新父容器顏色與系統欄圖示明暗
     */
    fun updateThemeColor(colorHex: String) {
        try {
            val color = Color.parseColor(colorHex)
            rootLayout.setBackgroundColor(color)

            val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)
            val isLight = isColorLight(color)
            windowInsetsController.isAppearanceLightStatusBars = isLight
            windowInsetsController.isAppearanceLightNavigationBars = isLight
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun isColorLight(color: Int): Boolean {
        val darkness = 1 - (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255
        return darkness < 0.5
    }

    private fun addSecurityHeaders(orig: WebResourceResponse): WebResourceResponse {
        val mimeType = orig.mimeType ?: "text/plain"
        val encoding = orig.encoding ?: "utf-8"
        val inputStream = orig.data ?: ByteArrayInputStream(ByteArray(0))

        val headers = HashMap<String, String>()
        headers["Content-Security-Policy"] = "default-src 'self' $SERVER_URL; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        headers["X-Frame-Options"] = "DENY"

        return WebResourceResponse(
            mimeType, encoding, 200, "OK", headers, inputStream
        )
    }
}