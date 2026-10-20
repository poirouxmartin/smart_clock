package expo.modules.smartalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/** Schedules the screen-brightening ramp that precedes the alarm. */
object DawnScheduler {
    private const val TAG = "SmartAlarm"
    const val EXTRA_START = "dawnStartMs"
    const val EXTRA_TARGET = "dawnTargetMs"

    private const val REQUEST_CODE = 2101
    private const val PENDING_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    /**
     * Schedules the dawn ramp so that it ends at [targetAtMs].
     * Returns true if a dawn was scheduled (exact or inexact) or started right now, false otherwise.
     */
    fun schedule(ctx: Context, targetAtMs: Long): Boolean {
        if (!WakeOptions.dawnEnabled(ctx)) {
            cancel(ctx)
            return false
        }
        val now = System.currentTimeMillis()
        val startMs = targetAtMs - WakeOptions.dawnMinutes(ctx) * 60_000L
        if (startMs <= now) {
            if (targetAtMs > now) {
                DawnReceiver.show(ctx, now, targetAtMs)
                return true
            }
            return false
        }

        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(ctx, REQUEST_CODE, receiverIntent(ctx, startMs, targetAtMs), PENDING_FLAGS)
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, startMs, pi)
                return true
            } catch (e: SecurityException) {
                Log.w(TAG, "setExactAndAllowWhileIdle refused, using inexact alarm", e)
            }
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, startMs, pi)
        return true
    }

    /** Cancels the pending dawn alarm, closes a running DawnActivity and removes its notification. */
    fun cancel(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(
            ctx,
            REQUEST_CODE,
            receiverIntent(ctx, 0L, 0L),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        )
        if (pi != null) {
            am.cancel(pi)
            pi.cancel()
        }
        DawnActivity.finishIfRunning()
        ctx.getSystemService(NotificationManager::class.java).cancel(DawnReceiver.NOTIF_ID)
    }

    private fun receiverIntent(ctx: Context, startMs: Long, targetMs: Long): Intent =
        Intent(ctx, DawnReceiver::class.java)
            .putExtra(EXTRA_START, startMs)
            .putExtra(EXTRA_TARGET, targetMs)
}
