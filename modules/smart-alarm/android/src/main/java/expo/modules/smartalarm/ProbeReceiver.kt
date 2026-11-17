package expo.modules.smartalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import kotlin.math.abs
import kotlin.math.sqrt

/** Samples motion and light for a few seconds on each automatic probe, then hands the sample to AutoManager. */
class ProbeReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CANCEL_ALARM = "expo.modules.smartalarm.CANCEL_ALARM"
        private const val TAG = "SmartAlarm"
        private const val SAMPLE_MS = 5_000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            AutoManager.ACTION_PROBE -> runProbe(context, goAsync())
            UpcomingAlarm.ACTION_SKIP -> UpcomingAlarm.skipNext(context)
            ACTION_CANCEL_ALARM -> {
                NightSession.cancel(context)
                NotificationManagerCompat.from(context).cancel(NightSession.NOTIF_AWAKE_ID)
            }
        }
    }

    private fun runProbe(ctx: Context, pending: BroadcastReceiver.PendingResult) {
        Thread {
            try {
                AutoManager.onProbe(ctx, sample(ctx, System.currentTimeMillis()))
            } catch (e: Exception) {
                Log.w(TAG, "Probe failed", e)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun sample(ctx: Context, now: Long): SleepProbe {
        val sm = ctx.getSystemService(SensorManager::class.java)
        val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val light = sm.getDefaultSensor(Sensor.TYPE_LIGHT)
        val thread = HandlerThread("smartalarm-probe").apply { start() }
        val handler = Handler(thread.looper)

        val lock = Any()
        var motionSum = 0.0
        var motionCount = 0
        var gravity = 0.0
        var gravityInit = false
        val lights = mutableListOf<Float>()

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                synchronized(lock) {
                    when (event.sensor.type) {
                        Sensor.TYPE_LIGHT -> lights.add(event.values[0])
                        Sensor.TYPE_ACCELEROMETER -> {
                            val x = event.values[0].toDouble()
                            val y = event.values[1].toDouble()
                            val z = event.values[2].toDouble()
                            val m = sqrt(x * x + y * y + z * z)
                            if (!gravityInit) {
                                gravity = m
                                gravityInit = true
                            } else {
                                gravity = 0.9 * gravity + 0.1 * m
                            }
                            motionSum += abs(m - gravity)
                            motionCount++
                        }
                    }
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        var motion: Double? = null
        var lux: Float? = null
        try {
            if (accel != null) sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_GAME, handler)
            if (light != null) sm.registerListener(listener, light, SensorManager.SENSOR_DELAY_GAME, handler)
            Thread.sleep(SAMPLE_MS)
        } finally {
            sm.unregisterListener(listener)
            thread.quitSafely()
        }
        synchronized(lock) {
            if (motionCount > 0) motion = motionSum / motionCount
            lux = median(lights)
        }

        val screenOn = ctx.getSystemService(PowerManager::class.java).isInteractive
        val battery = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL ||
            plugged != 0

        return SleepProbe(
            tMs = now,
            screenOn = screenOn,
            charging = charging,
            motion = motion,
            lux = lux,
            apiConfidence = AutoStore.freshApiConfidence(ctx, now),
        )
    }

    private fun median(values: List<Float>): Float? {
        if (values.isEmpty()) return null
        val s = values.sorted()
        val mid = s.size / 2
        return if (s.size % 2 == 1) s[mid] else (s[mid - 1] + s[mid]) / 2f
    }
}
