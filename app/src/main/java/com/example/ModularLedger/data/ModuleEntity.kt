package com.example.ModularLedger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "modules")
data class ModuleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val version: String,
    val author: String,
    val description: String,
    val folderName: String,
    val sourceType: String, // "user" 或 "system"
    val isEnabled: Boolean = true // 新增控制模組是否載入
)