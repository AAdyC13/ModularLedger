package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ModuleDao {
    // ==========================================
    //  區域 1: 模組管理 (來自商店分支，修復 AndroidBridge 錯誤)
    // ==========================================

    @Query("SELECT * FROM modules")
    fun getAllModulesSync(): List<ModuleEntity> // 供 Worker 同步使用

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertModule(module: ModuleEntity)

    @Query("DELETE FROM modules WHERE id = :moduleId")
    fun deleteModule(moduleId: String)

    // ==========================================
    //  區域 2: 模組內部儲存 (來自 Main 分支)
    // ==========================================

    // 讀取模組的特定設定
    @Query("SELECT value FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun getValue(moduleId: String, key: String): String?

    // 讀取模組的所有設定
    @Query("SELECT * FROM module_storage WHERE module_id = :moduleId")
    suspend fun getAllEntries(moduleId: String): List<ModuleKvEntry>

    // 寫入設定 (Upsert)
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setValue(entry: ModuleKvEntry)

    // 刪除特定設定
    @Query("DELETE FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun deleteValue(moduleId: String, key: String)

    // 刪除該模組所有資料 (當模組被移除時使用)
    @Query("DELETE FROM module_storage WHERE module_id = :moduleId")
    suspend fun clearModuleData(moduleId: String)
}