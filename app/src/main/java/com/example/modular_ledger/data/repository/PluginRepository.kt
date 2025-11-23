// app/src/main/java/com/example/modular_ledger/data/repository/PluginRepository.kt
package com.example.modular_ledger.data.repository

import com.example.modular_ledger.data.model.Plugin
import com.example.modular_ledger.data.source.local.PluginDao
import kotlinx.coroutines.flow.Flow

/**
 * 負責管理套件資料的 Repository。
 * 提供安裝、移除、啟用/停用以及查詢套件的 API。
 */
class PluginRepository(private val pluginDao: PluginDao) {

    /**
     * 取得所有已安裝套件的即時列表。
     */
    val allPlugins: Flow<List<Plugin>> = pluginDao.getAllPlugins()

    /**
     * 取得目前所有「啟用中」的套件列表 (用於 App 初始化載入)。
     */
    val enabledPlugins: Flow<List<Plugin>> = pluginDao.getEnabledPlugins()

    /**
     * 安裝新套件或更新現有套件。
     */
    suspend fun installPlugin(plugin: Plugin) {
        pluginDao.insertOrUpdatePlugin(plugin)
    }

    /**
     * 切換套件的啟用/停用狀態。
     */
    suspend fun setPluginEnabled(pluginId: String, isEnabled: Boolean) {
        pluginDao.updatePluginStatus(pluginId, isEnabled)
    }

    /**
     * 解除安裝套件。
     */
    suspend fun uninstallPlugin(plugin: Plugin) {
        pluginDao.deletePlugin(plugin)
    }
    
    /**
     * 根據 ID 取得特定套件資訊。
     */
    suspend fun getPlugin(pluginId: String): Plugin? {
        return pluginDao.getPluginById(pluginId)
    }
}