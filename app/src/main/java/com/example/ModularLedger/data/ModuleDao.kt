package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ModuleDao {
    // 取得所有模組 (包含啟用與未啟用)
    @Query("SELECT * FROM modules")
    fun getAllModulesSync(): List<ModuleEntity>

    // 更新模組啟用狀態
    @Query("UPDATE modules SET isEnabled = :isEnabled WHERE id = :moduleId")
    fun updateModuleStatus(moduleId: String, isEnabled: Boolean)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertModule(module: ModuleEntity)

    @Query("DELETE FROM modules WHERE id = :moduleId")
    fun deleteModule(moduleId: String)

    // --- Key-Value 儲存區 (維持原樣) ---
    @Query("SELECT value FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun getValue(moduleId: String, key: String): String?

    @Query("SELECT * FROM module_storage WHERE module_id = :moduleId")
    suspend fun getAllEntries(moduleId: String): List<ModuleKvEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setValue(entry: ModuleKvEntry)

    @Query("DELETE FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun deleteValue(moduleId: String, key: String)

    @Query("DELETE FROM module_storage WHERE module_id = :moduleId")
    suspend fun clearModuleData(moduleId: String)
}