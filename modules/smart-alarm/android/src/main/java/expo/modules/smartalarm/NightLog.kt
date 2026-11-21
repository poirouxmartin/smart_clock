package expo.modules.smartalarm

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Persistent ring of night events and process exit reasons, to diagnose a night that was cut. */
object NightLog {
    private const val TAG = "SmartAlarm"
    private const val FILE = "night_log.txt"
    internal const val MAX_LINES = 300

    @Synchronized
    fun add(ctx: Context, event: String) {
        try {
            val file = File(ctx.filesDir, FILE)
            val lines = if (file.exists()) file.readLines() else emptyList()
            val line = "${stamp(System.currentTimeMillis())} $event"
            file.writeText(trim(lines + line, MAX_LINES).joinToString("\n") + "\n")
        } catch (e: Exception) {
            Log.w(TAG, "Cannot write night log", e)
        }
    }

    @Synchronized
    fun read(ctx: Context): String = try {
        val file = File(ctx.filesDir, FILE)
        if (file.exists()) file.readText() else ""
    } catch (e: Exception) {
        Log.w(TAG, "Cannot read night log", e)
        ""
    }

    fun time(ms: Long): String = SimpleDateFormat("HH:mm", Locale.US).format(Date(ms))

    fun exitReasons(ctx: Context): String {
        if (Build.VERSION.SDK_INT < 30) return "n/a"
        return try {
            val am = ctx.getSystemService(ActivityManager::class.java)
            am.getHistoricalProcessExitReasons(ctx.packageName, 0, 10).joinToString("\n") { e ->
                "${stamp(e.timestamp)} ${reasonName(e.reason)}(${e.status}) imp=${e.importance} " +
                    "${e.description ?: ""} pss=${e.pss} rss=${e.rss}"
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cannot read exit reasons", e)
            "n/a"
        }
    }

    internal fun stamp(ms: Long): String =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(ms))

    /** Keeps the last [max] lines. */
    internal fun trim(lines: List<String>, max: Int): List<String> =
        if (lines.size > max) lines.takeLast(max) else lines

    internal fun reasonName(reason: Int): String = when (reason) {
        1 -> "EXIT_SELF"
        2 -> "SIGNALED"
        3 -> "LOW_MEMORY"
        4 -> "CRASH"
        5 -> "CRASH_NATIVE"
        6 -> "ANR"
        7 -> "INITIALIZATION_FAILURE"
        8 -> "PERMISSION_CHANGE"
        9 -> "EXCESSIVE_RESOURCE_USAGE"
        10 -> "USER_REQUESTED"
        11 -> "USER_STOPPED"
        12 -> "DEPENDENCY_DIED"
        13 -> "OTHER"
        14 -> "FREEZER"
        15 -> "PACKAGE_STATE_CHANGE"
        16 -> "PACKAGE_UPDATED"
        else -> reason.toString()
    }
}
