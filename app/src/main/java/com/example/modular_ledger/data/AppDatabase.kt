// app/src/main/java/com/example/ModularLedger/data/AppDatabase
package com.example.ModularLedger.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * 應用程式的 Room 資料庫主體。
 * 負責管理資料庫版本、實體 (Entities) 並提供 DAO 存取點。
 *
 * @property expenseDao 提供對 Expense 表的資料存取物件 (DAO)。
 */

@Database(entities = [Expense::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun expenseDao(): ExpenseDao

    companion object {
        /**
         * @Volatile 確保此變數的變動對所有執行緒立即可見。
         */
        @Volatile
        private var INSTANCE: AppDatabase? = null

        /**
         * 取得資料庫的單例 (Singleton) 實例。
         * 使用 double-checked locking 確保執行緒安全 (thread-safe)。
         *
         * @param context 應用程式上下文 (Application Context)，將用於初始化資料庫。
         * @return AppDatabase 的單例實例。
         */
        fun getDatabase(context: Context): AppDatabase {
            // 多執行緒環境下，同步檢查 INSTANCE 是否已被初始化
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "accounting_database.db" // 資料庫檔案名稱
                )
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}