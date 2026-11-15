package expo.modules.smartalarm

import android.content.Context
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/** Last wake-ups with what was really played, to diagnose silent or wrong-sound alarms. */
object WakeLog {
    private const val TAG = "SmartAlarm"
    private const val PREFS = "smart_alarm_wake_log"
    private const val KEY = "entries"
    private const val MAX_ENTRIES = 10

    fun appVersion(ctx: Context): String = try {
        val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        "${info.versionName} ($code)"
    } catch (e: Exception) {
        "?"
    }

    fun record(
        ctx: Context,
        atMs: Long,
        reason: String,
        requested: String,
        played: String?,
        player: String,
        error: String?,
        rampSeconds: Int,
    ) {
        val entry = JSONObject()
            .put("atMs", atMs)
            .put("reason", reason)
            .put("requested", requested)
            .put("played", played ?: "")
            .put("player", player)
            .put("error", error ?: "")
            .put("rampSeconds", rampSeconds)
            .put("appVersion", appVersion(ctx))
        val merged = JSONArray().put(entry)
        try {
            val old = JSONArray(read(ctx))
            var i = 0
            while (i < old.length() && merged.length() < MAX_ENTRIES) {
                merged.put(old.get(i))
                i++
            }
        } catch (e: Exception) {
            Log.w(TAG, "Wake log unreadable, starting over", e)
        }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, merged.toString()).apply()
        Log.i(TAG, "Wake: $entry")
    }

    fun read(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: "[]"
}
