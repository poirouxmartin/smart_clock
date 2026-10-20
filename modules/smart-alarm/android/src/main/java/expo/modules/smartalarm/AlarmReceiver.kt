package expo.modules.smartalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmartAlarm"
        private const val AUTO_TOLERANCE_MS = 30 * 60_000L

        internal fun startRing(ctx: Context, reason: String) {
            try {
                ContextCompat.startForegroundService(
                    ctx,
                    Intent(ctx, RingService::class.java).putExtra(AlarmScheduler.EXTRA_REASON, reason),
                )
            } catch (e: Exception) {
                Log.e(TAG, "Cannot start RingService for reason=$reason", e)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            AlarmScheduler.ACTION_FIRE ->
                onFire(context, intent.getStringExtra(AlarmScheduler.EXTRA_REASON) ?: "fallback")
        }
    }

    private fun onFire(ctx: Context, reason: String) {
        if (reason != "test") {
            val state = AlarmStore.state(ctx)
            // Auto mode arms the daily alarm without a session: it must ring even if no sleep was detected.
            val autoDue = AutoStore.enabled(ctx) &&
                kotlin.math.abs(System.currentTimeMillis() - AutoStore.currentTargetMs(ctx)) < AUTO_TOLERANCE_MS
            if (state == AlarmStore.RINGING || ((state == AlarmStore.DONE || state == AlarmStore.IDLE) && !autoDue)) {
                Log.i(TAG, "Ignoring $reason alarm, state=$state")
                return
            }
        }
        startRing(ctx, reason)
    }
}
