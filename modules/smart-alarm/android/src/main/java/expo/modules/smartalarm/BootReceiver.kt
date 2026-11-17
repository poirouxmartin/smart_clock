package expo.modules.smartalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmartAlarm"
        private const val MAX_LATE_MS = 30 * 60_000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            // LOCKED_BOOT_COMPLETED: a night reboot (system update) before unlock still re-arms (B3).
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> onReschedule(context, processRestarted = true)
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> onReschedule(context, processRestarted = false)
        }
    }

    private fun onReschedule(ctx: Context, processRestarted: Boolean) {
        val now = System.currentTimeMillis()
        // Alarms do not survive a reboot: a pending snooze is re-armed, a dead ring is closed (B1).
        val snoozeAt = AlarmStore.snoozeUntilMs(ctx)
        if (AlarmStore.state(ctx) == AlarmStore.RINGING && snoozeAt > now) {
            AlarmScheduler.scheduleSnooze(ctx, snoozeAt, "snooze")
        }
        AutoManager.recoverStaleRinging(ctx, now, afterBoot = processRestarted)
        if (AlarmStore.state(ctx) == AlarmStore.TRACKING) rescheduleTracking(ctx)
        AutoManager.rearm(ctx)
    }

    private fun rescheduleTracking(ctx: Context) {
        val target = AlarmStore.targetAtMs(ctx)
        val now = System.currentTimeMillis()
        when {
            target > now -> {
                AlarmScheduler.scheduleFallback(ctx, target)
                DawnScheduler.schedule(ctx, AlarmStore.targetAtMs(ctx))
                try {
                    ContextCompat.startForegroundService(ctx, Intent(ctx, SleepTrackingService::class.java))
                } catch (e: Exception) {
                    // Background FGS starts may be refused; the fallback alarm stays armed.
                    Log.w(TAG, "Cannot restart SleepTrackingService", e)
                }
            }
            now - target < MAX_LATE_MS -> AlarmReceiver.startRing(ctx, "fallback")
            else -> AlarmStore.edit(ctx) { putString("state", AlarmStore.DONE) }
        }
    }
}
