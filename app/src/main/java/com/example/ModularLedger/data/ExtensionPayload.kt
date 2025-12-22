package com.example.ModularLedger.data
data class ExtensionPayload(
        val moduleId: String, // 哪個模組發起的
        val json: String = "{}", // 模組要存的 JSON 資料
        val filePath: String? = null // (可選) 相關檔案路徑
)
