package expo.modules.smartalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

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
        NightSession.repair(ctx, now, afterBoot = processRestarted)
        AutoManager.rearm(ctx)
    }
}
