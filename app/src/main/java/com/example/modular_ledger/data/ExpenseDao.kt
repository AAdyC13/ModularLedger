package com.example.modular_ledger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {

    /**
     * 新增一筆記帳資料。
     * onConflict = OnConflictStrategy.REPLACE：如果發生衝突，就覆蓋舊資料。
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: Expense) // 非同步操作

    /**
     * 查詢記帳資料，降冪排列 (最新的在最上面)。
     * 回傳類型 Flow<List<Expense>> 允許您的 UI 自動響應資料庫變化。
     */
    @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
    fun getAllExpenses(): Flow<List<Expense>>
}