package com.example.ModularLedger.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "module_storage",
    primaryKeys = ["module_id", "key"],
    indices = [Index(value = ["module_id"])]
)
data class ModuleKvEntry(
    @ColumnInfo(name = "module_id") val moduleId: String,
    val key: String,
    val value: String, // 支援 JSON
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis()
)