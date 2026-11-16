package expo.modules.smartalarm

import android.content.Context
import android.content.SharedPreferences

/** Persistent alarm/night state, backed by SharedPreferences "smart_alarm". */
object AlarmStore {
    private const val PREFS = "smart_alarm"

    const val IDLE = "idle"
    const val TRACKING = "tracking"
    const val RINGING = "ringing"
    const val DONE = "done"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Synchronous write: returns true once persisted. */
    fun edit(ctx: Context, block: SharedPreferences.Editor.() -> Unit): Boolean {
        val editor = prefs(ctx).edit()
        editor.block()
        return editor.commit()
    }

    fun state(ctx: Context): String = prefs(ctx).getString("state", IDLE) ?: IDLE

    fun sessionId(ctx: Context): String? =
        prefs(ctx).getString("sessionId", null)?.takeIf { it.isNotEmpty() }

    fun startedAtMs(ctx: Context): Long = prefs(ctx).getLong("startedAtMs", 0L)

    fun targetAtMs(ctx: Context): Long = prefs(ctx).getLong("targetAtMs", 0L)

    fun windowMinutes(ctx: Context): Int = prefs(ctx).getInt("windowMinutes", 0)

    fun windowStartMs(ctx: Context): Long = targetAtMs(ctx) - windowMinutes(ctx) * 60_000L

    fun firedAtMs(ctx: Context): Long = prefs(ctx).getLong("firedAtMs", 0L)

    fun firedReason(ctx: Context): String? =
        prefs(ctx).getString("firedReason", null)?.takeIf { it.isNotEmpty() }

    fun snoozeUntilMs(ctx: Context): Long = prefs(ctx).getLong("snoozeUntilMs", 0L)

    fun setSnoozeUntilMs(ctx: Context, atMs: Long) {
        edit(ctx) { putLong("snoozeUntilMs", atMs) }
    }

    fun clearSnooze(ctx: Context) {
        edit(ctx) { remove("snoozeUntilMs") }
    }

    fun summarySeen(ctx: Context): Boolean = prefs(ctx).getBoolean("summarySeen", false)
}
