// app/src/main/java/com/example/modular_ledger/data/ExpenseRepository.kt

package com.example.modular_ledger.data

import kotlinx.coroutines.flow.Flow
import java.util.Date

/**
 * 儲存庫 (Repository) 模組，作為 [Expense] 資料的主要來源 (Single Source of Truth)。
 *
 * 此類別抽象化了資料來源 (在此情境下為 [ExpenseDao])，
 * 並提供一個乾淨的 API 介面供 [ExpenseViewModel] (或上層邏輯) 呼叫。
 *
 * @property expenseDao 資料存取物件 (DAO) 的實例，由外部注入 (DI)。
 */
class ExpenseRepository(private val expenseDao: ExpenseDao) {

    /**
     * (API-Read)
     * 一個可觀察的 [Flow]，持續發出所有 [Expense] 紀錄的列表 (依時間降冪)。
     * ViewModel (或上層) 應訂閱此 Flow 以取得即時資料更新。
     */
    val allExpenses: Flow<List<Expense>> = expenseDao.getAllExpenses()

    /**
     * (API-Read)
     * 依據 ID 取得單筆 [Expense] 紀錄的即時串流。
     * @param id 要查詢的 Expense ID。
     * @return 一個 [Flow]，發出符合的 [Expense] 或 null。
     */
    fun getExpenseById(id: Int): Flow<Expense?> {
        return expenseDao.getExpenseById(id)
    }

    /**
     * (API-Read)
     * 取得特定時間範圍內的所有 [Expense] 紀錄。
     * @param startTimestamp 開始時間戳 (UNIX-based, 單位：秒)。
     * @param endTimestamp 結束時間戳 (UNIX-based, 單位：秒)。
     * @return 一個 [Flow]，發出符合範圍的資料列表。
     */
    fun getExpensesByDateRange(startTimestamp: Long, endTimestamp: Long): Flow<List<Expense>> {
        return expenseDao.getExpensesByDateRange(startTimestamp, endTimestamp)
    }

    /**
     * (API-Create)
     * 異步(suspend)插入一筆 [Expense] 紀錄。
     * @param expense 要新增的 [Expense] 物件。
     */
    suspend fun insert(expense: Expense) {
        expenseDao.insertExpense(expense)
    }

    /**
     * (API-Update)
     * 異步(suspend)更新一筆 [Expense] 紀錄。
     * @param expense 要更新的 [Expense] 物件 (必須包含有效的 [id])。
     */
    suspend fun update(expense: Expense) {
        expenseDao.updateExpense(expense)
    }

    /**
     * (API-Delete)
     * 異步(suspend)刪除一筆 [Expense] 紀錄。
     * @param expense 要刪除的 [Expense] 物件。
     */
    suspend fun delete(expense: Expense) {
        expenseDao.deleteExpense(expense)
    }
}