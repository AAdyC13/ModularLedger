// app/src/main/java/com/example/ModularLedger/data/ExpenseDao.kt
package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * 資料存取物件 (DAO) for the [Expense] entity.
 * 定義所有與 'expenses' 資料表互動的 SQL 查詢。
 */
@Dao
interface ExpenseDao {

    /**
     * 插入一筆 [Expense] 紀錄。如果主鍵衝突，則取代舊有資料。
     * @param expense 要插入的資料實體。
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: Expense)

    /**
     * 查詢 'expenses' 表中的所有紀錄，並依時間戳降冪排序。
     * @return 一個 Flow (可觀察串流)，當資料變動時會自動發出新的列表。
     */
    @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
    fun getAllExpenses(): Flow<List<Expense>>

    /**
     * 依據 [id] 查詢單筆 [Expense] 紀錄。
     * @param id 要查詢的紀錄 ID。
     * @return 一個 Flow (可觀察串流)，發出符合 ID 的 [Expense] 或 null (如果找不到)。
     */
    @Query("SELECT * FROM expenses WHERE id = :id")
    fun getExpenseById(id: Int): Flow<Expense?>

    /**
     * 查詢特定時間範圍內的所有 [Expense] 紀錄。
     * @param startTimestamp 開始時間戳 (UNIX-based, 單位：秒)。
     * @param endTimestamp 結束時間戳 (UNIX-based, 單位：秒)。
     * @return 一個 Flow (可觀察串流)，發出符合範圍的資料列表。
     */
    @Query("SELECT * FROM expenses WHERE timestamp BETWEEN :startTimestamp AND :endTimestamp ORDER BY timestamp DESC")
    fun getExpensesByDateRange(startTimestamp: Long, endTimestamp: Long): Flow<List<Expense>>

    /**
     * 更新一筆現有的 [Expense] 紀錄。
     * @param expense 要更新的資料實體 (必須包含正確的 ID)。
     */
    @Update
    suspend fun updateExpense(expense: Expense)

    /**
     * 刪除一筆 [Expense] 紀錄。
     * @param expense 要刪除的資料實體。
     */
    @Delete
    suspend fun deleteExpense(expense: Expense)
}