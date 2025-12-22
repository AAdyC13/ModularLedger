package com.example.ModularLedger.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "module_transaction_extensions",
    foreignKeys = [
        ForeignKey(
            entity = Expense::class,
            parentColumns = ["id"],
            childColumns = ["expense_id"],
            onDelete = ForeignKey.CASCADE // 核心刪除，擴充自動刪除
        )
    ],
    indices = [
        Index(value = ["expense_id"]), // 加速 JOIN 查詢
        Index(value = ["module_id"])
    ]
)
data class ModuleTransactionExtension(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    
    // 這裡必須加上 @ColumnInfo(name = "expense_id") 才能被 Relation 識別
    @ColumnInfo(name = "expense_id") val expenseId: Long, 
    
    @ColumnInfo(name = "module_id") val moduleId: String,

    // 結構化擴充資料 (存放 JSON 字串)
    @ColumnInfo(name = "data_payload") val dataPayload: String = "{}",

    // 檔案/媒體路徑
    @ColumnInfo(name = "media_path") val mediaPath: String? = null,

    // 搜尋優化
    @ColumnInfo(name = "search_keywords") val searchKeywords: String? = null
)