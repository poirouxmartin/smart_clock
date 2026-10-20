package expo.modules.smartalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class RingService : Service() {

    companion object {
        private const val TAG = "SmartAlarm"
        private const val CHANNEL_ID = "smart_alarm_ring"
        private const val NOTIF_ID = 4242
        private const val STOP_REQUEST_CODE = 2001
        private const val ACTIVITY_REQUEST_CODE = 2002
        private const val WAKE_LOCK_MS = 30 * 60_000L
        private const val AUTO_STOP_MS = 20 * 60_000L
        private const val RAMP_TICK_MS = 1_000L
        private const val START_VOLUME = 0.15f
        private const val NATURE_START_VOLUME = 0.02f
        private val VIBRATE_PATTERN = longArrayOf(0, 800, 800)
    }

    private val handler = Handler(Looper.getMainLooper())
    private var ringing = false
    private var reason = "fallback"
    private var ringStartedMs = 0L
    private var rampMs = 60_000L
    private var startVolume = START_VOLUME
    private var natureSound = false
    private var player: MediaPlayer? = null
    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val rampStep = object : Runnable {
        override fun run() {
            val p = player ?: return
            val elapsed = System.currentTimeMillis() - ringStartedMs
            val volume = VolumeRamp.volume(elapsed, rampMs, startVolume)
            try {
                p.setVolume(volume, volume)
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Cannot set ring volume", e)
            }
            if (elapsed < rampMs) handler.postDelayed(this, RAMP_TICK_MS)
        }
    }

    private val vibrateLater = Runnable { startVibration() }

    private val autoStop = Runnable { stopAndFinish() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == AlarmScheduler.ACTION_STOP) {
            stopAndFinish()
            return START_NOT_STICKY
        }

        val fireReason = intent?.getStringExtra(AlarmScheduler.EXTRA_REASON) ?: "fallback"
        // Must run for every startForegroundService call, even when already ringing.
        showForeground(fireReason)
        if (ringing) return START_NOT_STICKY

        reason = fireReason
        ringing = true
        ringStartedMs = System.currentTimeMillis()
        rampMs = WakeOptions.rampSeconds(this) * 1000L

        // A test ring must not touch a real night (state, fallback alarm, tracking).
        if (reason != "test") {
            AlarmStore.edit(this) {
                putString("state", AlarmStore.RINGING)
                putLong("firedAtMs", ringStartedMs)
                putString("firedReason", reason)
                putBoolean("summarySeen", false)
            }
            AlarmScheduler.cancel(this)
            stopService(Intent(this, SleepTrackingService::class.java))
        }

        acquireWakeLock()
        startSound()
        // Nature sounds fade in silently; vibration starts once the ramp is complete.
        if (natureSound) handler.postDelayed(vibrateLater, rampMs) else startVibration()
        handler.post(rampStep)
        handler.postDelayed(autoStop, AUTO_STOP_MS)
        try {
            startActivity(activityIntent(reason))
        } catch (e: Exception) {
            Log.w(TAG, "Direct AlarmActivity launch refused; full-screen intent is the main path", e)
        }
        return START_NOT_STICKY
    }

    private fun activityIntent(reason: String): Intent =
        Intent(this, AlarmActivity::class.java)
            .putExtra(AlarmScheduler.EXTRA_REASON, reason)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)

    private fun showForeground(reason: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_alarm),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val textRes = when (reason) {
            "smart" -> R.string.ring_smart
            "test" -> R.string.ring_test
            else -> R.string.ring_fallback
        }
        val activityPi = PendingIntent.getActivity(
            this,
            ACTIVITY_REQUEST_CODE,
            activityIntent(reason),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val stopPi = PendingIntent.getService(
            this,
            STOP_REQUEST_CODE,
            Intent(this, RingService::class.java).setAction(AlarmScheduler.ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(getString(R.string.ring_title))
            .setContentText(getString(textRes))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setFullScreenIntent(activityPi, true)
            .setContentIntent(activityPi)
            .addAction(0, getString(R.string.stop), stopPi)
            .build()

        val fgsType = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, notification, fgsType)
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "smartalarm:ring").apply {
            setReferenceCounted(false)
            acquire(WAKE_LOCK_MS)
        }
    }

    private fun startSound() {
        val rawName = NatureSound.rawName(WakeOptions.sound(this))
        val rawId = if (rawName != null) resources.getIdentifier(rawName, "raw", packageName) else 0
        natureSound = rawId != 0
        startVolume = if (natureSound) NATURE_START_VOLUME else START_VOLUME

        val uri: Uri = if (natureSound) {
            Uri.parse("android.resource://$packageName/$rawId")
        } else {
            RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: return
        }

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        try {
            val mp = MediaPlayer()
            try {
                mp.setAudioAttributes(attrs)
                mp.setDataSource(this, uri)
                mp.isLooping = true
                mp.setVolume(startVolume, startVolume)
                mp.prepare()
                mp.start()
                player = mp
                return
            } catch (e: Exception) {
                Log.w(TAG, "MediaPlayer failed, falling back to Ringtone", e)
                mp.release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "MediaPlayer creation failed, falling back to Ringtone", e)
        }

        try {
            ringtone = RingtoneManager.getRingtone(this, uri)?.apply {
                audioAttributes = attrs
                if (Build.VERSION.SDK_INT >= 28) isLooping = true
                play()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Ringtone playback failed", e)
        }
    }

    private fun startVibration() {
        if (Build.VERSION.SDK_INT < 26) return
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= 31) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            getSystemService(Vibrator::class.java)
        }
        vibrator = v
        if (v == null || !v.hasVibrator()) return

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val effect = VibrationEffect.createWaveform(VIBRATE_PATTERN, 0)
        try {
            if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, attrs) else v.vibrate(effect)
        } catch (e: Exception) {
            Log.w(TAG, "Vibration failed", e)
        }
    }

    private fun stopRinging() {
        handler.removeCallbacks(vibrateLater)
        handler.removeCallbacksAndMessages(null)
        player?.let {
            try {
                it.stop()
            } catch (e: IllegalStateException) {
                Log.w(TAG, "MediaPlayer stop failed", e)
            }
            it.release()
        }
        player = null
        ringtone?.stop()
        ringtone = null
        vibrator?.cancel()
        vibrator = null
        ringing = false
    }

    private fun stopAndFinish() {
        stopRinging()
        if (reason != "test") {
            AlarmStore.edit(this) { putString("state", AlarmStore.DONE) }
            DawnActivity.finishIfRunning()
            DawnScheduler.cancel(this)
            try {
                AutoManager.rearm(applicationContext)
            } catch (e: Exception) {
                Log.w(TAG, "Cannot re-arm automatic alarm", e)
            }
        }
        AlarmActivity.finishCurrent()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopRinging()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }
}
