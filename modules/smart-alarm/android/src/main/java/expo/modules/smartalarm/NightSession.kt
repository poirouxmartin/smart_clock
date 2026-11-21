package expo.modules.smartalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Starts and cancels a night, manual or automatic. Mirrors SmartAlarmModule.startNight/cancelNight. */
object NightSession {
    private const val TAG = "SmartAlarm"
    private const val PREFS = "smart_alarm"
    const val CHANNEL_ID = "smart_alarm_auto"
    const val NOTIF_TAP_ID = 4244
    const val NOTIF_AWAKE_ID = 4245

    /** Returns true if the fallback alarm was scheduled as an exact alarm. */
    fun start(
        ctx: Context,
        targetAtMs: Long,
        windowMinutes: Int,
        auto: Boolean = false,
        onsetMs: Long = 0L,
    ): Boolean {
        val now = System.currentTimeMillis()

        // Stop any previous night first so its onDestroy finalizes with the old session's data.
        ctx.stopService(Intent(ctx, SleepTrackingService::class.java))

        val sessionId = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date(now))
        AlarmStore.edit(ctx) {
            putString("state", AlarmStore.TRACKING)
            putString("sessionId", sessionId)
            putLong("startedAtMs", now)
            putLong("targetAtMs", targetAtMs)
            putInt("windowMinutes", windowMinutes)
            putLong("firedAtMs", 0L)
            remove("firedReason")
            putBoolean("summarySeen", false)
            putBoolean("auto", auto)
            putLong("onsetMs", onsetMs)
        }
        UpcomingAlarm.refresh(ctx)
        NightFile.create(ctx, sessionId, now, targetAtMs, windowMinutes)
        val exact = AlarmScheduler.scheduleFallback(ctx, targetAtMs)
        DawnScheduler.schedule(ctx, targetAtMs)
        try {
            ContextCompat.startForegroundService(ctx, Intent(ctx, SleepTrackingService::class.java))
        } catch (e: Exception) {
            // Background FGS starts may be refused; the fallback alarm stays armed.
            Log.w(TAG, "Cannot start SleepTrackingService, fallback alarm stays armed", e)
            postTapNotification(ctx)
        }
        // Watchdog: restarts the tracking service if Android kills it without a sticky restart.
        AutoManager.scheduleNightCheck(ctx, now)
        NightLog.add(ctx, "start target=${NightLog.time(targetAtMs)} window=$windowMinutes auto=$auto exact=$exact")
        return exact
    }

    fun cancel(ctx: Context) {
        NightLog.add(ctx, "cancel state=${AlarmStore.state(ctx)}")
        AlarmScheduler.cancel(ctx)
        ctx.stopService(Intent(ctx, SleepTrackingService::class.java))
        if (AlarmStore.state(ctx) == AlarmStore.RINGING) {
            try {
                ctx.startService(Intent(ctx, RingService::class.java).setAction(AlarmScheduler.ACTION_STOP))
            } catch (e: Exception) {
                Log.w(TAG, "Cannot send stop to RingService", e)
            }
        }
        AlarmStore.edit(ctx) { putString("state", AlarmStore.IDLE) }
        DawnScheduler.cancel(ctx)
        AutoManager.rearm(ctx)
    }

    /**
     * Repairs a ghost night (TRACKING without a live service), see [AlarmPolicy.trackingRepair].
     * [afterBoot]: the process just restarted after a reboot or an update, so alarms may be gone.
     */
    fun repair(ctx: Context, now: Long = System.currentTimeMillis(), afterBoot: Boolean = false) {
        val target = AlarmStore.targetAtMs(ctx)
        val plan = AlarmPolicy.trackingRepair(
            AlarmStore.state(ctx),
            target,
            now,
            SleepTrackingService.running,
            afterBoot,
        )
        if (plan != AlarmPolicy.TrackingRepair.NONE) {
            NightLog.add(ctx, "repair $plan target=${NightLog.time(target)}")
        }
        when (plan) {
            AlarmPolicy.TrackingRepair.NONE -> return
            AlarmPolicy.TrackingRepair.RESTART_SERVICE -> {
                Log.w(TAG, "Night in progress without tracking service: restarting it")
                AlarmScheduler.scheduleFallback(ctx, target)
                DawnScheduler.schedule(ctx, target)
                try {
                    ContextCompat.startForegroundService(ctx, Intent(ctx, SleepTrackingService::class.java))
                } catch (e: Exception) {
                    Log.w(TAG, "Cannot restart SleepTrackingService, fallback alarm stays armed", e)
                    postTapNotification(ctx)
                }
            }
            AlarmPolicy.TrackingRepair.RING_LATE -> AlarmReceiver.startRing(ctx, "fallback")
            AlarmPolicy.TrackingRepair.CLOSE -> {
                Log.w(TAG, "Closing a ghost night long past its target")
                AlarmStore.sessionId(ctx)?.let { sid ->
                    // Keep whatever was recorded so the night still shows in Stats.
                    NightFile.finalize(ctx, sid, NightFile.loadEpochs(ctx, sid), target, 0L, "")
                }
                AlarmStore.edit(ctx) { putString("state", AlarmStore.DONE) }
            }
        }
    }

    fun onsetMs(ctx: Context): Long = prefs(ctx).getLong("onsetMs", 0L)

    fun isAuto(ctx: Context): Boolean = prefs(ctx).getBoolean("auto", false)

    internal fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                ctx.getString(R.string.channel_auto),
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun postTapNotification(ctx: Context) {
        try {
            ensureChannel(ctx)
            val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
            val pi = PendingIntent.getActivity(
                ctx,
                NOTIF_TAP_ID,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentText(ctx.getString(R.string.auto_tap_to_track))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build()
            NotificationManagerCompat.from(ctx).notify(NOTIF_TAP_ID, notification)
        } catch (e: Exception) {
            Log.w(TAG, "Cannot post tap-to-track notification", e)
        }
    }

    private fun prefs(ctx: Context) = Prefs.get(ctx, PREFS)
}
