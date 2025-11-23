// app/src/main/java/com/example/modular_ledger/data/controller/RawSqlController.kt
package com.example.modular_ledger.data.controller

import android.database.Cursor
import com.example.modular_ledger.data.source.local.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * 負責執行原生 SQL 的控制器。
 * 繞過 Room 的 Entity 限制，直接操作 SupportSQLiteDatabase。
 */
class RawSqlController(private val appDatabase: AppDatabase) {

    /**
     * 執行非查詢指令 (CREATE, INSERT, UPDATE, DELETE)
     * @param pluginId 用於未來擴充權限管理
     * @param sql SQL 語句
     * @param argsJsonArray 綁定參數 (Bind Arguments)
     */
    suspend fun execSQL(pluginId: String, sql: String, argsJsonArray: JSONArray?) = withContext(Dispatchers.IO) {
        val db = appDatabase.openHelper.writableDatabase
        
        // 將 JSON 陣列參數轉換為 Object 陣列
        val bindArgs = convertJsonArrayToBindArgs(argsJsonArray)

        // 執行 SQL
        if (bindArgs.isEmpty()) {
            db.execSQL(sql)
        } else {
            db.execSQL(sql, bindArgs)
        }
    }

    /**
     * 執行查詢指令 (SELECT)
     * @return List<Map<String, Any?>> 結構，方便轉回 JSON
     */
    suspend fun rawQuery(pluginId: String, sql: String, argsJsonArray: JSONArray?): List<Map<String, Any?>> = withContext(Dispatchers.IO) {
        val db = appDatabase.openHelper.readableDatabase
        
        // 查詢參數通常轉為 String 陣列處理
        val selectionArgs = convertJsonArrayToStringArgs(argsJsonArray)
        
        val cursor = db.query(sql, selectionArgs)
        return@withContext cursorToResultList(cursor)
    }

    // --- 輔助工具：將 Cursor 轉為 List ---
    private fun cursorToResultList(cursor: Cursor): List<Map<String, Any?>> {
        val result = mutableListOf<Map<String, Any?>>()
        cursor.use {
            if (it.moveToFirst()) {
                do {
                    val row = mutableMapOf<String, Any?>()
                    for (i in 0 until it.columnCount) {
                        val name = it.getColumnName(i)
                        val type = it.getType(i)
                        val value = when (type) {
                            Cursor.FIELD_TYPE_INTEGER -> it.getLong(i)
                            Cursor.FIELD_TYPE_FLOAT -> it.getDouble(i)
                            Cursor.FIELD_TYPE_STRING -> it.getString(i)
                            Cursor.FIELD_TYPE_BLOB -> null // 暫時忽略 Blob
                            else -> null
                        }
                        row[name] = value
                    }
                    result.add(row)
                } while (it.moveToNext())
            }
        }
        return result
    }

    // --- 輔助工具：參數轉換 ---
    private fun convertJsonArrayToBindArgs(jsonArray: JSONArray?): Array<Any?> {
        if (jsonArray == null) return emptyArray()
        val list = mutableListOf<Any?>()
        for (i in 0 until jsonArray.length()) {
            list.add(jsonArray.opt(i))
        }
        return list.toTypedArray()
    }
    
    private fun convertJsonArrayToStringArgs(jsonArray: JSONArray?): Array<String> {
        if (jsonArray == null) return emptyArray()
        val list = mutableListOf<String>()
        for (i in 0 until jsonArray.length()) {
            list.add(jsonArray.optString(i))
        }
        return list.toTypedArray()
    }
}