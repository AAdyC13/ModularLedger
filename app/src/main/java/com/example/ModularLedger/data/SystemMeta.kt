package com.example.ModularLedger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "system_meta")
data class SystemMeta(
    @PrimaryKey val key: String, 
    val value: String
)