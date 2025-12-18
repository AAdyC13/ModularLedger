package com.example.modular_ledger.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ModuleDao {
    // 獲取所有模組 (同步方法，供 BackgroundWorker 使用)
    @Query("SELECT * FROM modules")
    fun getAllModulesSync(): List<ModuleEntity>

    // 根據 ID 獲取模組
    @Query("SELECT * FROM modules WHERE id = :id")
    fun getModuleById(id: String): ModuleEntity?

    // 插入或更新模組資訊
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertModule(module: ModuleEntity)

    // 刪除模組
    @Delete
    fun deleteModule(module: ModuleEntity)
}