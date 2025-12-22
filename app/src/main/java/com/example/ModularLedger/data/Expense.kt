package com.example.ModularLedger.data

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation

@Entity(
    tableName = "expenses",
    indices = [Index(value = ["timestamp"])] // 加速時間範圍查詢
)
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val amount: Double, // 金額 (負數為支出，正數為收入)
    val timestamp: Long, // Unix Timestamp (秒)
    val type: Int = 0, // 0: 一般, 1: 轉帳, 2: 調整
    val description: String // 基礎描述
)

/**
 * 關聯查詢物件：包含核心消費與模組擴充資訊
 */
data class OrchestratedTransaction(
    @Embedded val core: Expense,
    
    @Relation(
        parentColumn = "id",
        entityColumn = "expense_id" // 對應 ModuleTransactionExtension 的 expense_id 欄位名稱
    )
    val extensions: List<ModuleTransactionExtension>
)