package com.example.ModularLedger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface SystemDao {
    @Query("SELECT value FROM system_meta WHERE `key` = :key")
    suspend fun getValue(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun setValue(meta: SystemMeta)

    @Query("DELETE FROM system_meta WHERE `key` = :key") suspend fun deleteValue(key: String)
}
