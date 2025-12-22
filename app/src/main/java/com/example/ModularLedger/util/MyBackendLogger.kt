package com.example.ModularLedger.util

import android.util.Log

/**
 * 實際執行日誌輸出的後端 Logger。
 * 這裡簡單封裝了 Android 的 Logcat。
 */
object MyBackendLogger {
    fun log(priority: Int, tag: String, message: String) {
        when (priority) {
            Log.VERBOSE -> Log.v(tag, message)
            Log.DEBUG -> Log.d(tag, message)
            Log.INFO -> Log.i(tag, message)
            Log.WARN -> Log.w(tag, message)
            Log.ERROR -> Log.e(tag, message)
            Log.ASSERT -> Log.wtf(tag, message)
            else -> Log.i(tag, message)
        }
    }
}
