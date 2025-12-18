package com.example.modular_ledger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 模組的資料庫實體。
 * 用於正規化管理已安裝的模組，避免每次都掃描檔案系統。
 */
@Entity(tableName = "modules")
data class ModuleEntity(
    @PrimaryKey
    val id: String,          // 模組唯一 ID (如 "system.Calculator")
    val name: String,        // 模組名稱
    val version: String,     // 版本號
    val author: String,
    val description: String,
    val folderName: String,  // 在 userModules 資料夾下的名稱 (通常等於 id)
    val sourceType: String,  // "user" (使用者下載) 或 "system" (內建)
    val installDate: Long = System.currentTimeMillis()
)