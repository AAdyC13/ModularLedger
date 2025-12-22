package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ModuleDao {
    // 讀取模組的特定設定
    @Query("SELECT value FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun getValue(moduleId: String, key: String): String?

    // 讀取模組的所有設定 (回傳 Map 需自定義 Converter，這裡先回傳 List 讓 Repo 處理)
    @Query("SELECT * FROM module_storage WHERE module_id = :moduleId")
    suspend fun getAllEntries(moduleId: String): List<ModuleKvEntry>

    // 寫入設定 (Upsert: 有則更新，無則新增)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun setValue(entry: ModuleKvEntry)

    // 刪除特定設定
    @Query("DELETE FROM module_storage WHERE module_id = :moduleId AND `key` = :key")
    suspend fun deleteValue(moduleId: String, key: String)

    // 刪除該模組所有資料 (當模組被移除時使用)
    @Query("DELETE FROM module_storage WHERE module_id = :moduleId")
    suspend fun clearModuleData(moduleId: String)
}
