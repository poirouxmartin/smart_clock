package expo.modules.smartalarm

import android.content.Context
import android.content.SharedPreferences
import android.os.UserManager
import android.util.Log

/**
 * Alarm preferences live in device-protected storage, readable before the first unlock, so a
 * night reboot (system update) can re-arm the alarm from LOCKED_BOOT_COMPLETED (B3).
 * Files from older versions are moved over once the user storage is unlocked.
 */
internal object Prefs {
    private const val TAG = "SmartAlarm"
    private val migrated = mutableSetOf<String>()

    fun get(ctx: Context, name: String): SharedPreferences {
        val app = ctx.applicationContext ?: ctx
        val device = app.createDeviceProtectedStorageContext()
        synchronized(migrated) {
            if (name !in migrated && app.getSystemService(UserManager::class.java)?.isUserUnlocked == true) {
                try {
                    if (!device.moveSharedPreferencesFrom(app, name)) Log.w(TAG, "Cannot move prefs $name")
                } catch (e: Exception) {
                    Log.w(TAG, "Cannot move prefs $name", e)
                }
                migrated += name
            }
        }
        return device.getSharedPreferences(name, Context.MODE_PRIVATE)
    }
}
