package expo.modules.smartalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

object AlarmScheduler {
    private const val TAG = "SmartAlarm"
    const val ACTION_FIRE = "expo.modules.smartalarm.FIRE"
    const val ACTION_STOP = "expo.modules.smartalarm.STOP"
    const val ACTION_SNOOZE = "expo.modules.smartalarm.SNOOZE"
    const val EXTRA_REASON = "reason"

    private const val FALLBACK_REQUEST_CODE = 1001
    private const val TEST_REQUEST_CODE = 1002
    private const val SHOW_REQUEST_CODE = 1003
    private const val SNOOZE_REQUEST_CODE = 1004

    private const val FIRE_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    /** Schedules the target-time fallback. Returns true if scheduled as an exact alarm. */
    fun scheduleFallback(ctx: Context, targetAtMs: Long): Boolean =
        schedule(ctx, targetAtMs, FALLBACK_REQUEST_CODE, "fallback")

    fun scheduleTest(ctx: Context, atMs: Long): Boolean =
        schedule(ctx, atMs, TEST_REQUEST_CODE, "test")

    fun scheduleSnooze(ctx: Context, atMs: Long, reason: String): Boolean =
        schedule(ctx, atMs, SNOOZE_REQUEST_CODE, reason)

    fun cancelSnooze(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(
            ctx,
            SNOOZE_REQUEST_CODE,
            fireIntent(ctx, "snooze"),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        )
        if (pi != null) {
            am.cancel(pi)
            pi.cancel()
        }
    }

    fun cancel(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        for (requestCode in listOf(FALLBACK_REQUEST_CODE, TEST_REQUEST_CODE)) {
            val pi = PendingIntent.getBroadcast(
                ctx,
                requestCode,
                fireIntent(ctx, "fallback"),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            if (pi != null) {
                am.cancel(pi)
                pi.cancel()
            }
        }
    }

    private fun fireIntent(ctx: Context, reason: String): Intent =
        Intent(ctx, AlarmReceiver::class.java)
            .setAction(ACTION_FIRE)
            .putExtra(EXTRA_REASON, reason)

    private fun schedule(ctx: Context, atMs: Long, requestCode: Int, reason: String): Boolean {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val firePi = PendingIntent.getBroadcast(ctx, requestCode, fireIntent(ctx, reason), FIRE_FLAGS)

        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            try {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, showPendingIntent(ctx)), firePi)
                return true
            } catch (e: SecurityException) {
                Log.w(TAG, "setAlarmClock refused, using inexact alarm", e)
            }
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, firePi)
        return false
    }

    /** PendingIntent shown in the status bar alarm indicator: opens the app. */
    private fun showPendingIntent(ctx: Context): PendingIntent {
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
        return PendingIntent.getActivity(
            ctx,
            SHOW_REQUEST_CODE,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
