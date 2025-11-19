package com.example.modular_ledger

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.example.modular_ledger.ui.theme.Modular_ledgerTheme


class MainActivity : AppCompatActivity() {
    companion object {
    private const val USE_LOCAL_FILE = false
    //private const val SERVER_URL = "http://10.0.2.2:3000/" // 模擬器用
    private const val SERVER_URL = "http://163.18.29.38:3000/"  // 實體裝置用
    private const val LOCAL_URL = "file:///android_asset/www/index.html"
}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                view?.loadUrl(url ?: "")
                return true
            }
        }

        WebView.setWebContentsDebuggingEnabled(true)

        // 根據設定載入不同來源
        val url = if (USE_LOCAL_FILE) LOCAL_URL else SERVER_URL
        webView.loadUrl(url)
    }
}


@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
    Text(
        text = "Hello $name!",
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    Modular_ledgerTheme {
        Greeting("Android")
    }
}