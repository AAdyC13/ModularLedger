package com.example.ModularLedger.util

import android.util.Log

/**
 * Logcat 工具類，處理長字串的分段輸出。
 * Android Logcat 單條日誌有長度限制 (約 4KB)，超過部分會被截斷。
 */
object LogHelper {
    private const val MAX_LOG_LENGTH = 4000

    fun printSplitLog(priority: Int, tag: String, message: String) {
        if (message.length < MAX_LOG_LENGTH) {
            MyBackendLogger.log(priority, tag, message)
            return
        }

        // 字串太長，進行分段輸出
        var i = 0
        while (i < message.length) {
            var end = i + MAX_LOG_LENGTH
            if (end > message.length) {
                end = message.length
            }
            MyBackendLogger.log(priority, tag, message.substring(i, end))
            i = end
        }
    }
}
