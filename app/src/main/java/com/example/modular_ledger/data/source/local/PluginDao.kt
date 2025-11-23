// app/src/main/java/com/example/modular_ledger/data/source/local/PluginDao.kt
package com.example.modular_ledger.data.source.local

import com.example.modular_ledger.data.model.Plugin
import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface PluginDao {

    /**
     * 安裝或更新套件。如果 pluginId 已存在，則覆蓋舊資料 (適用於更新版本)。
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdatePlugin(plugin: Plugin)

    /**
     * 取得所有已安裝的套件列表 (無論是否啟用)。
     */
    @Query("SELECT * FROM plugins ORDER BY displayName ASC")
    fun getAllPlugins(): Flow<List<Plugin>>

    /**
     * 僅取得「已啟用」的套件，這通常是 App 啟動時載入擴充功能的依據。
     */
    @Query("SELECT * FROM plugins WHERE isEnabled = 1")
    fun getEnabledPlugins(): Flow<List<Plugin>>

    /**
     * 根據 ID 查詢特定套件。
     */
    @Query("SELECT * FROM plugins WHERE pluginId = :pluginId")
    suspend fun getPluginById(pluginId: String): Plugin?

    /**
     * 更新套件啟用狀態。
     */
    @Query("UPDATE plugins SET isEnabled = :isEnabled WHERE pluginId = :pluginId")
    suspend fun updatePluginStatus(pluginId: String, isEnabled: Boolean)

    /**
     * 移除套件。
     */
    @Delete
    suspend fun deletePlugin(plugin: Plugin)
}