// app/src/main/java/com/example/ModularLedger/data/Expense.kt
package com.example.ModularLedger.data

import androidx.room.ColumnInfo
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
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
        val type: Int = 0, // 0: 一般, 1: 轉帳, 2: 調整 (預留欄位)
        val description: String // 基礎描述
)

@Entity(
        tableName = "module_transaction_extensions",
        foreignKeys =
                [
                        ForeignKey(
                                entity = Expense::class,
                                parentColumns = ["id"],
                                childColumns = ["expense_id"],
                                onDelete = ForeignKey.CASCADE // 核心刪除，擴充自動刪除
                        )],
        indices =
                [
                        Index(value = ["expense_id"]), // 加速 JOIN 查詢
                        Index(value = ["module_id"])]
)
data class ModuleTransactionExtension(
        @PrimaryKey(autoGenerate = true) val id: Long = 0,
        @ColumnInfo(name = "expense_id") val expenseId: Long,
        @ColumnInfo(name = "module_id") val moduleId: String,

        // 結構化擴充資料 (存放 JSON 字串)
        @ColumnInfo(name = "data_payload") val dataPayload: String = "{}",

        // 檔案/媒體路徑 (指向 /data/user/0/.../app_modules/...)
        @ColumnInfo(name = "media_path") val mediaPath: String? = null,

        // 搜尋優化 (模組可將重要的可搜尋文字複製一份到此)
        @ColumnInfo(name = "search_keywords") val searchKeywords: String? = null
)

@Entity(tableName = "module_storage", primaryKeys = ["module_id", "key"])
data class ModuleKvEntry(
        @ColumnInfo(name = "module_id") val moduleId: String,
        val key: String,
        val value: String, // 支援 JSON
        @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "system_meta")
data class SystemMeta(@PrimaryKey val key: String, val value: String)

data class OrchestratedTransaction(
        @Embedded val core: Expense,
        @Relation(parentColumn = "id", entityColumn = "expense_id")
        val extensions: List<ModuleTransactionExtension>
)
