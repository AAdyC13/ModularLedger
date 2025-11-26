package com.example.modular_ledger

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.modular_ledger.ui.theme.Modular_ledgerTheme
import com.example.modular_ledger.viewmodel.ExpenseViewModel
import com.example.modular_ledger.viewmodel.ExpenseViewModelFactory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import com.example.modular_ledger.data.source.local.AppDatabase
import com.example.modular_ledger.data.controller.RawSqlController
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

class MainActivity : AppCompatActivity() {
    private lateinit var assetLoader: WebViewAssetLoader

    companion object {
        private const val SERVER_URL = "http://163.18.29.38:3000/" // 實體裝置用
        private const val LOCAL_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        
        val webView = WebView(this)

        // WebView 基本設定
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false // 不要開 file:// 讀取
        settings.allowContentAccess = false
        settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE

        // 建立 AssetLoader
        assetLoader =
                WebViewAssetLoader.Builder()
                        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                        .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
                        .build()

        webView.webViewClient =
                object : WebViewClient() {
                    override fun shouldInterceptRequest(
                            view: WebView,
                            request: WebResourceRequest
                    ): WebResourceResponse? {
                        // 1) 先讓 assetLoader 嘗試處理
                        val response = assetLoader.shouldInterceptRequest(request.url)
                        if (response != null) {
                            // 可在這裡包一層 header (例如加入 CSP)
                            return addSecurityHeaders(response)
                        }

                        // 2) 其他請求（外部） → 根據策略允許或阻擋
                        // return super.shouldInterceptRequest(view, request)
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
                        val url = request.url.toString()
                        // 嚴格控制導航：阻擋跳出 app 的外部連結（或提示使用外部瀏覽器）
                        if (isAllowedExternalUrl(url)) {
                            return false
                        } else {
                            // 攔截掉或顯示對話框
                            return true
                        }
                    }
                }

        webView.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")
        setContentView(webView)
        webView.loadUrl(LOCAL_URL) // 此處可調整 WebView 前端入口位置
    }
    
    private fun addSecurityHeaders(orig: WebResourceResponse): WebResourceResponse {
        // 如果你要加入 CSP header 或其他自訂 header，可建立新的 WebResourceResponse 並包入 headers
        val mimeType = orig.mimeType ?: "text/plain"
        val encoding = orig.encoding ?: "utf-8"
        val inputStream = orig.data ?: ByteArrayInputStream(ByteArray(0))

        // 範例 CSP：只允許同 origin 的資源與指定域名（依實際需求調整）
        val headers = HashMap<String, String>()
        headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self';"
        headers["X-Frame-Options"] = "DENY"

        return WebResourceResponse(
                mimeType,
                encoding, /*statusCode*/
                200, /*reasonPhrase*/
                "OK",
                headers,
                inputStream
        )
    }

    private fun isAllowedExternalUrl(url: String): Boolean {
        // 例如只允許特定 API 網域，或使用 external browser
        return url.startsWith("https://www.example.com")
    }
}
