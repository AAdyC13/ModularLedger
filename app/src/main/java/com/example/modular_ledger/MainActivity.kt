package com.example.modular_ledger

import android.app.Application
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import com.example.modular_ledger.data.source.local.AppDatabase // 新增
import com.example.modular_ledger.data.controller.RawSqlController // 新增



class MainActivity : AppCompatActivity() {
    companion object {
    private const val USE_LOCAL_SERVER = false
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
        val url = if (USE_LOCAL_SERVER) LOCAL_URL else SERVER_URL
        webView.loadUrl(url)
    }
}

@Composable
fun ExpenseTestScreen(modifier: Modifier = Modifier) {
    // 取得 Application Context
    val application = LocalContext.current.applicationContext as Application

    // 使用建立的工廠 (Factory) 來初始化 ViewModel
    val viewModel: ExpenseViewModel = viewModel(
        factory = ExpenseViewModelFactory(application)
    )

    // 訂閱 (Collect) allExpenses 這個 Flow
    val expenses by viewModel.allExpenses.collectAsState(initial = emptyList())

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "API 測試畫面",
            style = MaterialTheme.typography.headlineMedium
        )

        Spacer(modifier = Modifier.height(20.dp))

        // 測試 API (Create) 的按鈕
        Button(onClick = {
            // 呼叫 ViewModel 的 API
            viewModel.addExpense(
                amount = (100..1000).random().toDouble(), // 隨機金額
                description = "這是一筆測試資料",
                dateToSave = Date()
            )
        }) {
            Text("新增一筆測試資料")
        }

        Spacer(modifier = Modifier.height(20.dp))

        // 顯示 API (Read) 的資料列表
        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            items(items = expenses, key = { it.id }) { expense ->
                val formattedAmount = String.format(Locale.getDefault(), "%.2f", expense.amount)
                val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                val formattedDate = try {
                    val d = Date(expense.timestamp * 1000)
                    sdf.format(d)
                } catch (e: Exception) {
                    ""
                }

                Text(
                    text = "ID: ${expense.id} | 金額: $formattedAmount | 描述: ${expense.description}" +
                            if (formattedDate.isNotEmpty()) " | 時間: $formattedDate" else "",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                )
            }
        }
    }
}