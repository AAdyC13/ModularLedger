package com.example.ModularLedger.data

import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

class LedgerRepository(private val dao: ExpenseDao) {

    // 對外暴露完整的帳目資料流
    val allTransactions: Flow<List<OrchestratedTransaction>> = dao.getAllTransactions()

    // 核心邏輯：同時寫入
    @Transaction
    suspend fun createTransaction(core: Expense, rawExtensions: List<ExtensionPayload>) {
        // 1. 寫入核心，取得 ID
        val newId = dao.insertCore(core)

        // 2. 準備擴充資料 (將 ID 綁定進去)
        val extensions =
                rawExtensions.map { payload ->
                    ModuleTransactionExtension(
                            expenseId = newId,
                            moduleId = payload.moduleId,
                            dataPayload = payload.json,
                            mediaPath = payload.filePath
                    )
                }

        // 3. 寫入擴充
        dao.insertExtensions(extensions)
    }

    fun getTransactionsByDateRange(start: Long, end: Long): Flow<List<OrchestratedTransaction>> {
        return dao.getTransactionsByDateRange(start, end)
    }

    suspend fun delete(expense: Expense) {
        dao.deleteCore(expense)
    }

    suspend fun update(expense: Expense) {
        dao.updateCore(expense)
    }
}
