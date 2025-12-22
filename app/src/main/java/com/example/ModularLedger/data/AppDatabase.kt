// app/src/main/java/com/example/ModularLedger/data/AppDatabase
package com.example.ModularLedger.data

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
        entities =
                [
                        Expense::class,
                        ModuleTransactionExtension::class, // 新增
                        ModuleKvEntry::class, // 新增
                        SystemMeta::class // 新增
                ],
        version = 2, // 升級
        exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
        abstract fun expenseDao(): ExpenseDao
        abstract fun moduleDao(): ModuleDao
        abstract fun systemDao(): SystemDao
}
