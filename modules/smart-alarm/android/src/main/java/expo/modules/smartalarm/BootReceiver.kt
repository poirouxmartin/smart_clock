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
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> onReschedule(context)
        }
    }

    private fun onReschedule(ctx: Context) {
        if (AlarmStore.state(ctx) != AlarmStore.TRACKING) return
        val target = AlarmStore.targetAtMs(ctx)
        val now = System.currentTimeMillis()
        when {
            target > now -> {
                AlarmScheduler.scheduleFallback(ctx, target)
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
