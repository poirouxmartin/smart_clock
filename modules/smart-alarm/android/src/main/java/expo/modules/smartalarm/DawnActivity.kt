package expo.modules.smartalarm

import android.app.Activity
import android.app.NotificationManager
import android.content.Intent
import android.graphics.Color
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.util.Date

/** Full-screen screen-brightening ramp shown before the alarm. Built in code, no XML layout. */
class DawnActivity : Activity() {

    companion object {
        private const val TAG = "SmartAlarm"
        private const val TICK_MS = 2_000L
        private const val GRACE_MS = 20 * 60_000L

        @Volatile
        private var current: WeakReference<DawnActivity>? = null
        private val mainHandler = Handler(Looper.getMainLooper())

        /** Closes the running dawn screen, if any. Safe to call from any thread. */
        fun finishIfRunning() {
            mainHandler.post {
                current?.get()?.finish()
                current = null
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var startMs = 0L
    private var targetMs = 0L
    private var torchId: String? = null
    private var torchMaxLevel = 1
    private var torchSearched = false
    private lateinit var root: FrameLayout
    private lateinit var timeView: TextView
    private lateinit var hintView: TextView

    private val tick = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            if (now > targetMs + GRACE_MS) {
                finish()
                return
            }
            val p = DawnCurve.progress(now, startMs, targetMs)
            window.attributes = window.attributes.apply { screenBrightness = DawnCurve.brightness(p) }
            root.setBackgroundColor(DawnCurve.color(p))
            val textColor = if (p > 0.6) 0x66000000 else 0x33000000
            timeView.setTextColor(textColor)
            hintView.setTextColor(textColor)
            timeView.text = DateFormat.getTimeFormat(this@DawnActivity).format(Date(now))
            updateTorch(p)
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()

        readExtras(intent)
        if (startMs == 0L || targetMs == 0L) {
            finish()
            return
        }
        current = WeakReference(this)

        timeView = TextView(this).apply {
            textSize = 64f
            gravity = Gravity.CENTER
            setTextColor(0x33000000)
        }
        hintView = TextView(this).apply {
            textSize = 14f
            gravity = Gravity.CENTER
            setText(R.string.dawn_hint)
            setTextColor(0x33000000)
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            addView(
                timeView,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT),
            )
            addView(
                hintView,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = dp(24) },
            )
        }
        root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            setOnClickListener { finish() }
            addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        setContentView(root)
        getSystemService(NotificationManager::class.java).cancel(DawnReceiver.NOTIF_ID)
        tick.run()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readExtras(intent)
        if (startMs == 0L || targetMs == 0L) {
            finish()
            return
        }
        handler.removeCallbacks(tick)
        tick.run()
    }

    private fun readExtras(i: Intent) {
        startMs = i.getLongExtra(DawnScheduler.EXTRA_START, 0L)
        targetMs = i.getLongExtra(DawnScheduler.EXTRA_TARGET, 0L)
    }

    private fun updateTorch(p: Double) {
        if (Build.VERSION.SDK_INT < 33 || !WakeOptions.torch(this)) return
        try {
            val cm = getSystemService(CameraManager::class.java)
            if (!torchSearched) {
                torchSearched = true
                for (id in cm.cameraIdList) {
                    val chars = cm.getCameraCharacteristics(id)
                    if (chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true &&
                        chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
                    ) {
                        torchId = id
                        torchMaxLevel = chars.get(CameraCharacteristics.FLASH_INFO_STRENGTH_MAXIMUM_LEVEL) ?: 1
                        break
                    }
                }
            }
            val id = torchId ?: return
            if (torchMaxLevel > 1) {
                val level = DawnCurve.torchLevel(p, torchMaxLevel)
                if (level > 0) cm.turnOnTorchWithStrengthLevel(id, level)
            } else if (p >= 0.95) {
                cm.setTorchMode(id, true)
            }
        } catch (e: Exception) {
            Log.w(TAG, "torch unavailable", e)
        }
    }

    private fun turnTorchOff() {
        val id = torchId ?: return
        try {
            getSystemService(CameraManager::class.java).setTorchMode(id, false)
        } catch (e: Exception) {
            Log.w(TAG, "torch off failed", e)
        }
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (current?.get() === this) current = null
        turnTorchOff()
        getSystemService(NotificationManager::class.java).cancel(DawnReceiver.NOTIF_ID)
        super.onDestroy()
    }
}
