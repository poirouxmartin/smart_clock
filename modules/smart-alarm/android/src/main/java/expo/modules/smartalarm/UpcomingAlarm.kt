package expo.modules.smartalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import android.text.format.DateUtils
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Silent ongoing notification announcing the next automatic alarm, with a one-shot skip action. */
object UpcomingAlarm {
    private const val TAG = "SmartAlarm"
    const val CHANNEL_ID = "smart_alarm_upcoming"
    const val NOTIF_ID = 4246
    const val ACTION_SKIP = "expo.modules.smartalarm.SKIP_NEXT"
    private const val SKIP_REQUEST_CODE = 2204
    private const val OPEN_REQUEST_CODE = 2205

    /** Target to announce, or null when no notification should be shown. */
    fun targetToShow(enabled: Boolean, notifEnabled: Boolean, state: String, targetMs: Long, nowMs: Long): Long? {
        if (!enabled || !notifEnabled) return null
        if (state == AlarmStore.TRACKING || state == AlarmStore.RINGING) return null
        return if (targetMs > nowMs) targetMs else null
    }

    /** Posts or cancels the notification from the current store state. Never throws. */
    fun refresh(ctx: Context) {
        try {
            val now = System.currentTimeMillis()
            val target = targetToShow(
                AutoStore.enabled(ctx),
                AutoStore.upcomingNotifEnabled(ctx),
                AlarmStore.state(ctx),
                AutoStore.currentTargetMs(ctx),
                now,
            )
            if (target == null) {
                NotificationManagerCompat.from(ctx).cancel(NOTIF_ID)
            } else {
                post(ctx, target, now)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cannot refresh upcoming alarm notification", e)
        }
    }

    /** Skips the currently armed automatic occurrence; the next enabled day is armed instead. */
    fun skipNext(ctx: Context) {
        val target = AutoStore.currentTargetMs(ctx)
        if (target <= 0L) return
        AutoStore.save(ctx, skippedTargetMs = target)
        AlarmScheduler.cancel(ctx)
        DawnScheduler.cancel(ctx)
        AutoManager.rearm(ctx)
    }

    fun unskip(ctx: Context) {
        AutoStore.save(ctx, skippedTargetMs = 0L)
        AutoManager.rearm(ctx)
    }

    private fun post(ctx: Context, target: Long, now: Long) {
        val channel = NotificationChannel(CHANNEL_ID, ctx.getString(R.string.channel_upcoming), NotificationManager.IMPORTANCE_LOW)
        channel.setShowBadge(false)
        ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)

        val relative = DateUtils.getRelativeTimeSpanString(target, now, DateUtils.DAY_IN_MILLIS, DateUtils.FORMAT_SHOW_WEEKDAY).toString()
        // French day words are lowercase mid-sentence ("Réveil aujourd'hui à 07:30").
        val day = if (java.util.Locale.getDefault().language == "fr") relative.lowercase(java.util.Locale.FRENCH) else relative
        val timeFormat = DateFormat.getTimeFormat(ctx)
        val time = timeFormat.format(java.util.Date(target))
        val windowStart = timeFormat.format(java.util.Date(target - AutoStore.windowMinutes(ctx) * 60_000L))

        val skipPi = PendingIntent.getBroadcast(
            ctx,
            SKIP_REQUEST_CODE,
            Intent(ctx, ProbeReceiver::class.java).setAction(ACTION_SKIP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(ctx.getString(R.string.upcoming_title, day, time))
            .setContentText(ctx.getString(R.string.upcoming_text, windowStart, time))
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .addAction(0, ctx.getString(R.string.upcoming_skip), skipPi)
        ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
            builder.setContentIntent(
                PendingIntent.getActivity(
                    ctx,
                    OPEN_REQUEST_CODE,
                    it,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )
        }
        NotificationManagerCompat.from(ctx).notify(NOTIF_ID, builder.build())
    }
}
