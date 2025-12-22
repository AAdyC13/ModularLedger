// app/src/main/java/com/example/ModularLedger/data/ExpenseDao.kt
package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    // [讀取]：自動 JOIN 核心與擴充表
    @Transaction // 因為涉及多表查詢，必須加 Transaction
    @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<OrchestratedTransaction>>

    // [寫入]：這是原子操作，必須保證兩者同時成功
    // 注意：Room DAO 通常只能單表 Insert，所以這裡只負責核心
    // 複雜的「同時寫入」邏輯建議上移至 Repository 或使用 @Transaction 函數
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCore(expense: Expense): Long // 回傳新 ID

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExtensions(extensions: List<ModuleTransactionExtension>)

    @Transaction
    @Query("SELECT * FROM expenses WHERE timestamp BETWEEN :start AND :end ORDER BY timestamp DESC")
    fun getTransactionsByDateRange(start: Long, end: Long): Flow<List<OrchestratedTransaction>>

    @Delete
    suspend fun deleteCore(expense: Expense)

    @Update
    suspend fun updateCore(expense: Expense)
}
