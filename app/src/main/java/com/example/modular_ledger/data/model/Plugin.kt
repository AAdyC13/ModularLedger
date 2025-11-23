// app/src/main/java/com/example/modular_ledger/data/model/Plugin.kt
package com.example.modular_ledger.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 資料實體 (Entity)，代表已安裝的擴充套件 (Plugin)。
 *
 * @property pluginId 套件的唯一識別碼 (例如：'com.user.calendar_widget')。
 * @property displayName 套件顯示名稱 (例如：'日曆')。
 * @property version 套件版本號 (例如：'1.0.0')。
 * @property description 套件描述。
 * @property sourcePath 套件檔案的本機儲存路徑 (例如：'/data/.../plugins/calendar.js' 或 assets 路徑)。
 * @property configJson 套件的設定資料 (JSON 格式字串)，用於儲存該套件的客製化設定。
 * @property isEnabled 是否啟用此套件。
 * @property installedTimestamp 安裝時間戳。
 */
@Entity(tableName = "plugins")
data class Plugin(
    @PrimaryKey
    val pluginId: String,
    
    val displayName: String,
    val version: String,
    val description: String = "",
    val sourcePath: String,
    val configJson: String = "{}", 
    val isEnabled: Boolean = true,
    val installedTimestamp: Long = System.currentTimeMillis()
)