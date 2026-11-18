package expo.modules.smartalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.text.format.DateFormat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.Date
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max

/** Overnight accelerometer tracking. Samples at 20 Hz, closes an epoch every minute. */
class SleepTrackingService : Service(), SensorEventListener {

    companion object {
        const val ACTION_STOP_TRACKING = "expo.modules.smartalarm.STOP_TRACKING"
        private const val TAG = "SmartAlarm"
        private const val CHANNEL_ID = "smart_alarm_tracking"
        private const val NOTIF_ID = 4241
        private const val STOP_REQUEST_CODE = 2003
        private const val SAMPLING_PERIOD_US = 50_000
        private const val SAVE_EVERY_EPOCHS = 5
        private const val MIN_WAKE_LOCK_MS = 60 * 60_000L
        private const val EXTRA_WAKE_MS = 60 * 60_000L
        private const val MANUAL_SLEEP_LATENCY_MS = 15 * 60_000L

        /** True while this process holds a sensing service; false after a kill or a refused start. */
        @Volatile
        var running: Boolean = false

        @Volatile
        var epochCount: Int = 0

        @Volatile
        var lastActivity: Double = 0.0

        @Volatile
        var lastSamples: Int = 0

        private const val EXPECTED_SAMPLES = (NightFile.EPOCH_MS * 1000 / SAMPLING_PERIOD_US).toInt()
    }

    private var sessionId = ""
    private var targetAtMs = 0L
    private var windowStartMs = 0L
    private val epochs = mutableListOf<NightFile.Epoch>()

    // Sensor-thread state (only touched on sensorHandler's thread after start).
    private val accumulator = EpochAccumulator()

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var sensorThread: HandlerThread? = null
    private var sensorHandler: Handler? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var listening = false
    private var screenReceiverRegistered = false

    // Some devices stop delivering sensor events after screen off unless the listener is registered again.
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            sensorHandler?.post { if (listening) reregisterListener("screen off") }
        }
    }

    private val epochTick = object : Runnable {
        override fun run() {
            closeEpoch()
            if (listening) sensorHandler?.postDelayed(this, NightFile.EPOCH_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_TRACKING) {
            // End the night like the app does; stopping only the service left a ghost TRACKING state.
            NightSession.cancel(applicationContext)
            stopSelf()
            return START_NOT_STICKY
        }

        // Called for every startForegroundService, so the foreground promise is kept even if we stop below.
        startForegroundNotification()

        val session = AlarmStore.sessionId(this)
        if (AlarmStore.state(this) != AlarmStore.TRACKING || session == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (sensorThread != null) return START_STICKY

        sessionId = session
        targetAtMs = AlarmStore.targetAtMs(this)
        windowStartMs = AlarmStore.windowStartMs(this)

        epochs.clear()
        epochs.addAll(NightFile.loadEpochs(this, sessionId))
        epochCount = epochs.size
        lastActivity = epochs.lastOrNull()?.activity ?: 0.0

        val now = System.currentTimeMillis()
        val timeoutMs = max(targetAtMs - now + EXTRA_WAKE_MS, MIN_WAKE_LOCK_MS)
        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "smartalarm:tracking")
            .apply {
                setReferenceCounted(false)
                acquire(timeoutMs)
            }

        startSensing()
        running = true
        // Sticky: if the system kills us overnight it restarts the service, which resumes from the night file.
        return START_STICKY
    }

    private fun startSensing() {
        val sm = getSystemService(SensorManager::class.java)
        val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val thread = HandlerThread("smartalarm-sensor").apply { start() }
        val handler = Handler(thread.looper)
        sensorManager = sm
        sensorThread = thread
        sensorHandler = handler
        accelerometer = accel

        listening = true
        if (accel == null) {
            Log.w(TAG, "No accelerometer: night relies on the target-time fallback")
        } else {
            sm.registerListener(this, accel, SAMPLING_PERIOD_US, 0, handler)
            ContextCompat.registerReceiver(
                this,
                screenOffReceiver,
                IntentFilter(Intent.ACTION_SCREEN_OFF),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            screenReceiverRegistered = true
        }
        handler.postDelayed(epochTick, NightFile.EPOCH_MS)
    }

    /** Runs on the sensor thread. */
    private fun reregisterListener(why: String) {
        val sm = sensorManager ?: return
        val accel = accelerometer ?: return
        Log.w(TAG, "Re-registering accelerometer listener ($why)")
        sm.unregisterListener(this)
        sm.registerListener(this, accel, SAMPLING_PERIOD_US, 0, sensorHandler)
    }

    private fun unregisterScreenReceiver() {
        if (!screenReceiverRegistered) return
        screenReceiverRegistered = false
        try {
            unregisterReceiver(screenOffReceiver)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Screen receiver already unregistered", e)
        }
    }

    private fun stopListening() {
        listening = false
        sensorManager?.unregisterListener(this)
        sensorHandler?.removeCallbacks(epochTick)
        unregisterScreenReceiver()
    }

    override fun onSensorChanged(event: SensorEvent) {
        accumulator.add(event.values[0].toDouble(), event.values[1].toDouble(), event.values[2].toDouble())
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    /** Runs on the sensor thread. */
    private fun closeEpoch() {
        val now = System.currentTimeMillis()
        val res = accumulator.close()
        val activity = res.activity
        epochs.add(NightFile.Epoch(now, activity, res.maxDelta, res.samples))
        epochCount = epochs.size
        lastActivity = activity
        lastSamples = res.samples
        Log.i(TAG, "Epoch: samples=${res.samples} activity=$activity maxDelta=${res.maxDelta} floor=${accumulator.noiseFloor}")

        if (listening && accelerometer != null && res.samples < EXPECTED_SAMPLES / 10) {
            reregisterListener("only ${res.samples}/$EXPECTED_SAMPLES samples")
        }

        if (epochs.size % SAVE_EVERY_EPOCHS == 0) {
            NightFile.rewrite(applicationContext, sessionId, epochs.toList())
        }
        evaluate(now, activity)
    }

    /** Runs on the sensor thread. */
    private fun evaluate(now: Long, activity: Double) {
        if (now >= targetAtMs) {
            // Past target: the fallback alarm owns the wake-up now.
            stopListening()
            stopSelf()
            return
        }
        if (now < windowStartMs) return

        val history = epochs.filter { it.tMs < windowStartMs }.map { it.activity }
        val recent = epochs.filter { it.tMs >= windowStartMs }.map { it.activity }
        val onset = NightSession.onsetMs(this).takeIf { it > 0 } ?: (AlarmStore.startedAtMs(this) + MANUAL_SLEEP_LATENCY_MS)
        val reason = WakeDecider.decide(now, windowStartMs, targetAtMs, history, recent, onset, AutoStore.freshApiConfidence(this, now))
        if (reason != null) {
            Log.i(TAG, "Smart wake: $reason")
            stopListening()
            try {
                ContextCompat.startForegroundService(
                    this,
                    Intent(this, RingService::class.java).putExtra(AlarmScheduler.EXTRA_REASON, "smart"),
                )
            } catch (e: Exception) {
                Log.e(TAG, "Cannot start RingService for smart wake", e)
            }
        }
    }

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_tracking),
                NotificationManager.IMPORTANCE_LOW,
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val fmt = DateFormat.getTimeFormat(this)
        val windowText = getString(
            R.string.tracking_text,
            fmt.format(Date(AlarmStore.windowStartMs(this))),
            fmt.format(Date(AlarmStore.targetAtMs(this))),
        )
        val stopPi = PendingIntent.getService(
            this,
            STOP_REQUEST_CODE,
            Intent(this, SleepTrackingService::class.java).setAction(ACTION_STOP_TRACKING),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(getString(R.string.tracking_title))
            .setContentText(windowText)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(0, getString(R.string.stop_night), stopPi)
            .build()

        val fgsType = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, notification, fgsType)
    }

    override fun onDestroy() {
        running = false
        val handler = sensorHandler
        val thread = sensorThread
        if (handler != null && thread != null) {
            // Stop sensor callbacks on their own thread before reading epochs here.
            val done = CountDownLatch(1)
            handler.post {
                try {
                    stopListening()
                } finally {
                    done.countDown()
                }
            }
            done.await(3, TimeUnit.SECONDS)
            thread.quitSafely()
        }
        sensorThread = null
        sensorHandler = null
        sensorManager = null

        if (sessionId.isNotEmpty()) {
            NightFile.finalize(
                applicationContext,
                sessionId,
                epochs.toList(),
                System.currentTimeMillis(),
                AlarmStore.firedAtMs(this),
                AlarmStore.firedReason(this) ?: "",
            )
        }
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        epochCount = 0
        lastActivity = 0.0
        lastSamples = 0
        super.onDestroy()
    }
}
