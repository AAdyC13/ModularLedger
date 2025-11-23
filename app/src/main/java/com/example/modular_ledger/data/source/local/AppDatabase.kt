// app/src/main/java/com/example/modular_ledger/data/source/local/AppDatabase.kt
package com.example.modular_ledger.data.source.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.modular_ledger.data.model.Expense
import com.example.modular_ledger.data.model.Plugin // 新增引用

/**
 * 應用程式的 Room 資料庫主體。
 * 更新：加入 Plugin 支援，版本號升級為 2。
 */
@Database(entities = [Expense::class, Plugin::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun expenseDao(): ExpenseDao
    abstract fun pluginDao(): PluginDao // 新增：提供 PluginDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        // 定義從版本 1 到版本 2 的遷移策略
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS `plugins` (
                        `pluginId` TEXT NOT NULL, 
                        `displayName` TEXT NOT NULL, 
                        `version` TEXT NOT NULL, 
                        `description` TEXT NOT NULL, 
                        `sourcePath` TEXT NOT NULL, 
                        `configJson` TEXT NOT NULL, 
                        `isEnabled` INTEGER NOT NULL, 
                        `installedTimestamp` INTEGER NOT NULL, 
                        PRIMARY KEY(`pluginId`)
                    )
                """.trimIndent())
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "accounting_database.db"
                )
                .addMigrations(MIGRATION_1_2) // 加入遷移策略
                .fallbackToDestructiveMigration() // 開發初期如果不想處理遷移，可暫時取消註解此行並移除 addMigrations
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}