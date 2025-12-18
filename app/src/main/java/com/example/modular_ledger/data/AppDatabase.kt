package com.example.modular_ledger.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * 應用程式的 Room 資料庫主體。
 * 已新增 ModuleEntity 與 ModuleDao。
 */
@Database(entities = [Expense::class, ModuleEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun expenseDao(): ExpenseDao
    abstract fun moduleDao(): ModuleDao // 新增模組 DAO

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "accounting_database.db"
                )
                // 注意：開發階段使用破壞性遷移 (清除資料)，正式上線可能須使用 addMigrations
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}