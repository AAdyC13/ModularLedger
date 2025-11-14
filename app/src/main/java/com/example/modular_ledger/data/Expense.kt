package com.example.modular_ledger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "expenses")
data class Expense(

    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    
    // 狀態為整數
    val timestamp: Long,

    // 金額，浮點數，可用於幣值轉換，避免錯誤
    val amount: Double,
    val description: String
)