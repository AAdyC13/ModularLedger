// app/src/main/java/com/example/modular_ledger/viewmodel/ExpenseViewModel.kt

package com.example.modular_ledger.viewmodel

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.modular_ledger.data.AppDatabase
import com.example.modular_ledger.data.Expense
import com.example.modular_ledger.data.ExpenseRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Date

/**
 * 負責處理 [Expense] 相關的業務邏輯，並作為 UI 層與 [ExpenseRepository] 之間的橋樑。
 *
 * 此 ViewModel 應由 [ExpenseViewModelFactory] 建立，以注入 [ExpenseRepository] 依賴。
 * 這是前端 (UI) 層應主要互動的 API 介面。
 *
 * @property repository [Expense] 資料的儲存庫實例。
 */
class ExpenseViewModel(private val repository: ExpenseRepository) : ViewModel() {

    /**
     * (API-Read)
     * 提供給 UI 層訂閱的所有 [Expense] 紀錄 (即時串流, 依時間降冪)。
     */
    val allExpenses: Flow<List<Expense>> = repository.allExpenses

    /**
     * (API-Read)
     * 依據指定的日期範圍查詢 [Expense] 紀錄。
     * 此 API 接收 [Date] 物件，並在內部處理轉換為後端 [Repository] 所需的 Long (秒) 時間戳。
     *
     * @param startDate 查詢的開始日期 (包含)。ViewModel 會將此轉換為當日 00:00:00 的時間戳。
     * @param endDate 查詢的結束日期 (包含)。ViewModel 會將此轉換為當日 23:59:59 的時間戳。
     * @return 一個 [Flow]，發出符合範圍的資料列表。
     */
    fun getExpensesInDateRange(startDate: Date, endDate: Date): Flow<List<Expense>> {
        
        // 業務邏輯：將傳入的 Date 物件轉換為標準的 UNIX 秒數時間戳
        
        // 將 startDate 設為 00:00:00
        val calStart = Calendar.getInstance().apply { time = startDate }
        calStart.set(Calendar.HOUR_OF_DAY, 0)
        calStart.set(Calendar.MINUTE, 0)
        calStart.set(Calendar.SECOND, 0)
        val startSeconds = calStart.timeInMillis / 1000

        // 將 endDate 設為 23:59:59
        val calEnd = Calendar.getInstance().apply { time = endDate }
        calEnd.set(Calendar.HOUR_OF_DAY, 23)
        calEnd.set(Calendar.MINUTE, 59)
        calEnd.set(Calendar.SECOND, 59)
        val endSeconds = calEnd.timeInMillis / 1000
        
        // 呼叫 Repository API
        return repository.getExpensesByDateRange(startSeconds, endSeconds)
    }


    /**
     * (API-Create)
     * 建立並插入一筆新的 [Expense] 紀錄。
     * 此函式包含業務邏輯 (資料驗證、時間戳轉換)。
     *
     * @param amount 金額 (Double)。正數為收入，負數為支出。
     * @param description 交易備註。
     * @param dateToSave 交易發生的日期 (由 UI 層傳入)。
     */
    fun addExpense(amount: Double, description: String, dateToSave: Date) {
        
        // 業務邏輯：驗證金額
        if (amount == 0.0) {
            // 在真實的 App 中，這裡應該是拋出一個錯誤狀態 (e.g., via a StateFlow) 給 UI
            println("ViewModel 錯誤：金額不能為 0")
            return
        }

        // 業務邏輯：轉換資料
        val timestampInSeconds = dateToSave.time / 1000

        // 建立實體 (ID 設為 0，Room 會自動產生)
        val newExpense = Expense(
            id = 0,
            timestamp = timestampInSeconds,
            amount = amount,
            description = description
        )

        // 在 viewModelScope (一個綁定 ViewModel 生命週期的 CoroutineScope) 中安全地呼叫 suspend 函式
        viewModelScope.launch {
            repository.insert(newExpense)
        }
    }

    /**
     * (API-Delete)
     * 刪除一筆 [Expense] 紀錄。
     * @param expense 要刪除的資料實體。
     */
    fun deleteExpense(expense: Expense) {
        viewModelScope.launch {
            repository.delete(expense)
        }
    }

    /**
     * (API-Update)
     * 更新一筆 [Expense] 紀錄。
     * @param expense 要更新的資料實體 (必須包含正確的 ID)。
     */
    fun updateExpense(expense: Expense) {
        viewModelScope.launch {
            repository.update(expense)
        }
    }
}

/**
 * [ViewModelProvider.Factory] 用於建立 [ExpenseViewModel] 實例。
 *
 * 此工廠類別是必要的，因為 [ExpenseViewModel] 具有自定義的建構子 (需要 [Application] 來取得 Repository)。
 * 前端 (UI) 層在初始化 ViewModel 時必須使用此工廠。
 *
 * @param application 應用程式實例，用於取得資料庫上下文。
 */
class ExpenseViewModelFactory(private val application: Application) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ExpenseViewModel::class.java)) {
            // 負責建立並注入依賴 (DI)
            val dao = AppDatabase.getDatabase(application).expenseDao()
            val repository = ExpenseRepository(dao)
            
            @Suppress("UNCHECKED_CAST")
            return ExpenseViewModel(repository) as T
        }
        throw IllegalArgumentException("未知的 ViewModel class")
    }
}