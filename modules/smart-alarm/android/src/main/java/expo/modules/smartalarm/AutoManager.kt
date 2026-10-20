package expo.modules.smartalarm

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.SleepSegmentRequest
import java.util.Calendar

/** Automatic sleep detection: probes around the usual bedtime and starts a night when onset is seen. */
object AutoManager {
    private const val TAG = "SmartAlarm"
    const val ACTION_PROBE = "expo.modules.smartalarm.PROBE"
    private const val PROBE_REQUEST_CODE = 2201
    private const val SLEEP_API_REQUEST_CODE = 2202
    private const val CANCEL_REQUEST_CODE = 2203
    private const val PROBE_INTERVAL_MS = 15 * 60_000L
    private const val PERIOD_BEFORE_BED_MIN = 180
    private const val DAY_MIN = 1440
    private const val LAST_START_BEFORE_TARGET_MS = 60 * 60_000L
    private const val MIN_ONSET_LEAD_MS = 20 * 60_000L
    private const val FALSE_ONSET_MS = 45 * 60_000L
    private const val EARLY_WAKE_MS = 90 * 60_000L

    fun configure(ctx: Context, enabled: Boolean, hour: Int, minute: Int, daysMask: Int, windowMinutes: Int) {
        AutoStore.save(
            ctx,
            enabled = enabled,
            hour = hour,
            minute = minute,
            daysMask = daysMask,
            windowMinutes = windowMinutes,
        )
        if (enabled) {
            rearm(ctx)
            return
        }
        cancelProbe(ctx)
        unregisterSleepApi(ctx)
        val state = AlarmStore.state(ctx)
        if (state != AlarmStore.TRACKING && state != AlarmStore.RINGING) {
            AlarmScheduler.cancel(ctx)
            DawnScheduler.cancel(ctx)
        }
    }

    /** Re-arms the automatic target. A running or ringing session already owns the alarm. */
    fun rearm(ctx: Context) {
        if (!AutoStore.enabled(ctx)) return
        val now = System.currentTimeMillis()
        val state = AlarmStore.state(ctx)
        if (state == AlarmStore.TRACKING || state == AlarmStore.RINGING) {
            scheduleNext(ctx, now)
            return
        }
        val target = AutoSchedule.nextTargetMs(
            now,
            AutoStore.hour(ctx),
            AutoStore.minute(ctx),
            AutoStore.daysMask(ctx),
        ) ?: return
        AutoStore.save(ctx, currentTargetMs = target)
        AutoStore.clearProbes(ctx)
        AlarmScheduler.scheduleFallback(ctx, target)
        DawnScheduler.schedule(ctx, target)
        registerSleepApi(ctx)
        scheduleNext(ctx, now)
    }

    /** Called by ProbeReceiver with the sensor sample taken at probe time. */
    fun onProbe(ctx: Context, probe: SleepProbe) {
        if (!AutoStore.enabled(ctx)) return
        AutoStore.addProbe(ctx, probe)
        val now = System.currentTimeMillis()
        val minuteOf: (Long) -> Int = { AutoSchedule.minuteOfDay(it) }
        val usual = AutoStore.usualBedMinute(ctx)
        val probes = AutoStore.probes(ctx)

        val state = AlarmStore.state(ctx)
        if (state == AlarmStore.TRACKING) {
            if (NightSession.isAuto(ctx)) {
                val awake = SleepOnsetDetector.isAwake(probes, minuteOf, usual)
                if (awake && now - NightSession.onsetMs(ctx) < FALSE_ONSET_MS) {
                    Log.i(TAG, "False sleep onset, stopping automatic night")
                    ctx.stopService(Intent(ctx, SleepTrackingService::class.java))
                    AlarmStore.edit(ctx) { putString("state", AlarmStore.IDLE) }
                    rearm(ctx)
                    return
                }
                val windowStart = AlarmStore.windowStartMs(ctx)
                val target = AlarmStore.targetAtMs(ctx)
                if (awake &&
                    now >= windowStart - EARLY_WAKE_MS &&
                    now < windowStart &&
                    AutoStore.awakeNotifiedTargetMs(ctx) != target
                ) {
                    postAwakeNotification(ctx, target)
                }
            }
        } else if (state != AlarmStore.RINGING) {
            val target = AutoStore.currentTargetMs(ctx)
            val onset = SleepOnsetDetector.onset(probes, minuteOf, usual)
            if (onset != null && target - now > MIN_ONSET_LEAD_MS) {
                AutoStore.addOnsetMinute(ctx, AutoSchedule.minuteOfDay(onset))
                NightSession.start(
                    ctx,
                    target,
                    AutoStore.windowMinutes(ctx),
                    auto = true,
                    onsetMs = onset,
                )
            }
        }
        scheduleNext(ctx, now)
    }

    /** Exact alarm to ProbeReceiver. */
    fun scheduleProbe(ctx: Context, atMs: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = probePendingIntent(ctx)
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact probe refused, using inexact alarm", e)
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        }
    }

    fun cancelProbe(ctx: Context) {
        val pi = PendingIntent.getBroadcast(
            ctx,
            PROBE_REQUEST_CODE,
            probeIntent(ctx),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        ) ?: return
        ctx.getSystemService(AlarmManager::class.java).cancel(pi)
        pi.cancel()
    }

    @SuppressLint("MissingPermission")
    fun registerSleepApi(ctx: Context) {
        if (!activityPermissionGranted(ctx)) return
        try {
            ActivityRecognition.getClient(ctx).requestSleepSegmentUpdates(
                sleepApiPendingIntent(ctx),
                SleepSegmentRequest(SleepSegmentRequest.CLASSIFY_EVENTS_ONLY),
            )
        } catch (e: Exception) {
            Log.w(TAG, "Cannot register Sleep API updates", e)
        }
    }

    fun unregisterSleepApi(ctx: Context) {
        try {
            ActivityRecognition.getClient(ctx).removeSleepSegmentUpdates(sleepApiPendingIntent(ctx))
        } catch (e: Exception) {
            Log.w(TAG, "Cannot unregister Sleep API updates", e)
        }
    }

    /** Next probe time, or null when no probe is useful before the target. */
    internal fun nextProbeTime(ctx: Context, now: Long): Long? {
        val target = AutoStore.currentTargetMs(ctx)
        if (target <= now) return null
        val usual = AutoStore.usualBedMinute(ctx)
        val targetMinute = AutoSchedule.minuteOfDay(target)
        if (SleepOnsetDetector.inDetectionPeriod(AutoSchedule.minuteOfDay(now), usual, targetMinute)) {
            return now + PROBE_INTERVAL_MS
        }
        val startMinute = Math.floorMod(usual - PERIOD_BEFORE_BED_MIN, DAY_MIN)
        val cal = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, startMinute / 60)
            set(Calendar.MINUTE, startMinute % 60)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
        val start = cal.timeInMillis
        return if (start > target - LAST_START_BEFORE_TARGET_MS) null else start
    }

    /** Schedules the next probe for the current state, or cancels probing. */
    private fun scheduleNext(ctx: Context, now: Long) {
        when (AlarmStore.state(ctx)) {
            AlarmStore.TRACKING -> {
                val next = now + PROBE_INTERVAL_MS
                if (NightSession.isAuto(ctx) && next < AlarmStore.windowStartMs(ctx)) {
                    scheduleProbe(ctx, next)
                } else {
                    cancelProbe(ctx)
                }
            }
            AlarmStore.IDLE, AlarmStore.DONE -> {
                val next = nextProbeTime(ctx, now)
                if (next != null) scheduleProbe(ctx, next) else cancelProbe(ctx)
            }
            else -> cancelProbe(ctx)
        }
    }

    private fun postAwakeNotification(ctx: Context, target: Long) {
        NightSession.ensureChannel(ctx)
        val cancelPi = PendingIntent.getBroadcast(
            ctx,
            CANCEL_REQUEST_CODE,
            Intent(ctx, ProbeReceiver::class.java).setAction(ProbeReceiver.ACTION_CANCEL_ALARM),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(ctx, NightSession.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentText(ctx.getString(R.string.auto_awake_text))
            .setAutoCancel(true)
            .addAction(0, ctx.getString(R.string.auto_cancel_alarm), cancelPi)
            .build()
        NotificationManagerCompat.from(ctx).notify(NightSession.NOTIF_AWAKE_ID, notification)
        AutoStore.save(ctx, awakeNotifiedTargetMs = target)
    }

    private fun probeIntent(ctx: Context): Intent =
        Intent(ctx, ProbeReceiver::class.java).setAction(ACTION_PROBE)

    private fun probePendingIntent(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(
            ctx,
            PROBE_REQUEST_CODE,
            probeIntent(ctx),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun sleepApiPendingIntent(ctx: Context): PendingIntent {
        val flags = if (Build.VERSION.SDK_INT >= 31) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getBroadcast(
            ctx,
            SLEEP_API_REQUEST_CODE,
            Intent(ctx, SleepApiReceiver::class.java),
            flags,
        )
    }

    private fun activityPermissionGranted(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 29 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) ==
            PackageManager.PERMISSION_GRANTED
}
