package expo.modules.smartalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/** Fires at the start of the dawn ramp and opens DawnActivity. */
class DawnReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        val startMs = intent.getLongExtra(DawnScheduler.EXTRA_START, 0L)
        val targetMs = intent.getLongExtra(DawnScheduler.EXTRA_TARGET, 0L)
        if (targetMs > System.currentTimeMillis() && WakeOptions.dawnEnabled(ctx)) {
            show(ctx, startMs, targetMs)
        }
    }

    companion object {
        const val NOTIF_ID = 4243
        private const val TAG = "SmartAlarm"
        private const val CHANNEL_ID = "smart_alarm_dawn"
        private const val ACTIVITY_REQUEST_CODE = 2102

        /** Posts the dawn notification (full-screen intent) and tries to open DawnActivity directly. */
        fun show(ctx: Context, startMs: Long, targetMs: Long) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= 26) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    ctx.getString(R.string.channel_dawn),
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    setSound(null, null)
                    enableVibration(false)
                }
                nm.createNotificationChannel(channel)
            }

            val activityIntent = Intent(ctx, DawnActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra(DawnScheduler.EXTRA_START, startMs)
                .putExtra(DawnScheduler.EXTRA_TARGET, targetMs)
            val pi = PendingIntent.getActivity(
                ctx,
                ACTIVITY_REQUEST_CODE,
                activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(ctx.getString(R.string.dawn_title))
                .setContentText(ctx.getString(R.string.dawn_text))
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setSilent(true)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .build()
            nm.notify(NOTIF_ID, notification)

            try {
                ctx.startActivity(activityIntent)
            } catch (e: Exception) {
                Log.w(TAG, "direct DawnActivity start refused, notification only", e)
            }
        }
    }
}
