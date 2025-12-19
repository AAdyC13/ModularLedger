// app/src/main/java/com/example/ModularLedger/data/Expense.kt
package com.example.ModularLedger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 資料實體 (Entity)，代表 'expenses' 資料表中的單筆紀錄。
 *
 * @property id 自動產生的主鍵 (Primary Key)。
 * @property timestamp 交易時間戳 (UNIX-based, 單位：秒)。儲存為 Long 以確保 2038 年問題相容性。
 * @property amount 金額 (Double)。正數為收入，負數為支出。
 * @property description 交易描述或備註。
 */
@Entity(tableName = "expenses")
data class Expense(

    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    
    val timestamp: Long,
    val amount: Double,
    val description: String
)