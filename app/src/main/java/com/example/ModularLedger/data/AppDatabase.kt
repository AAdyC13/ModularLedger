package com.example.ModularLedger.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        Expense::class,
        ModuleEntity::class,             // 來自商店分支：用於儲存已安裝模組資訊
        ModuleTransactionExtension::class,
        ModuleKvEntry::class,
        SystemMeta::class
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun expenseDao(): ExpenseDao
    abstract fun moduleDao(): ModuleDao
    abstract fun systemDao(): SystemDao

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
                // 注意：開發階段若更動資料表結構，此選項會清除舊資料以避免崩潰
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}