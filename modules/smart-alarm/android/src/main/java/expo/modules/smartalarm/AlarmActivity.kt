package expo.modules.smartalarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.util.Date

/** Full-screen ring UI shown over the lock screen. Built in code, no XML layout. */
class AlarmActivity : Activity() {

    companion object {
        private var current: WeakReference<AlarmActivity>? = null
        private const val MAX_START_P = 0.6

        /** Called by RingService when ringing ends. */
        fun finishCurrent() {
            current?.get()?.finish()
            current = null
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var timeView: TextView

    private val clockTick = object : Runnable {
        override fun run() {
            timeView.text = DateFormat.getTimeFormat(this@AlarmActivity).format(Date())
            handler.postDelayed(this, 15_000L)
        }
    }

    private lateinit var rootView: View
    private lateinit var subtitleView: TextView
    private var startP = 0.0
    private var rampMs = 0L
    private var createdAt = 0L

    /** Light rises from the dawn progress to full over the sound ramp. */
    private val lightTick = object : Runnable {
        override fun run() {
            val p = DawnCurve.ringProgress(startP, System.currentTimeMillis() - createdAt, rampMs)
            rootView.setBackgroundColor(DawnCurve.color(p))
            window.attributes = window.attributes.apply { screenBrightness = DawnCurve.brightness(p) }
            val text = if (p < 0.75) Color.WHITE else 0xFF3A2410.toInt()
            timeView.setTextColor(text)
            subtitleView.setTextColor(text)
            if (p < 1.0) handler.postDelayed(this, 1_000L)
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
        current = WeakReference(this)

        val reason = intent.getStringExtra(AlarmScheduler.EXTRA_REASON) ?: "fallback"
        // Rescue path: the broadcast could not start RingService, so start it from the foreground.
        if (intent.getBooleanExtra(RingService.EXTRA_START_RING, false) && !RingService.isRinging) {
            runCatching { AlarmReceiver.startRing(this, reason) }
        }
        val now = System.currentTimeMillis()
        val targetMs = AlarmStore.targetAtMs(this)
        // Continue from the dawn already shown, capped so the last stretch always rises with the
        // sound; a stale target (auto night without a session) starts from dark.
        startP = if (reason != "test" && WakeOptions.dawnEnabled(this) && targetMs > 0L && now <= targetMs + 5 * 60_000L) {
            minOf(MAX_START_P, DawnCurve.progress(now, targetMs - WakeOptions.dawnMinutes(this) * 60_000L, targetMs))
        } else {
            0.0
        }
        rampMs = WakeOptions.rampSeconds(this) * 1000L
        createdAt = now

        timeView = TextView(this).apply {
            textSize = 72f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setText(
                when (reason) {
                    "smart" -> R.string.ring_smart
                    "test" -> R.string.ring_test
                    "snooze" -> R.string.ring_snooze
                    else -> R.string.ring_fallback
                }
            )
        }
        val stopButton = Button(this).apply {
            setText(R.string.stop)
            textSize = 34f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(0xFF3A2410.toInt())
            setAllCaps(false)
            stateListAnimator = null
            background = GradientDrawable().apply {
                cornerRadius = dp(28).toFloat()
                setColor(0xFFFFE3B0.toInt())
                setStroke(dp(2), 0x66FFFFFF)
            }
            setOnClickListener { onStopClicked() }
        }
        val snoozeButton = Button(this).apply {
            setText(R.string.snooze)
            textSize = 22f
            setTextColor(Color.WHITE)
            setAllCaps(false)
            stateListAnimator = null
            background = GradientDrawable().apply {
                cornerRadius = dp(28).toFloat()
                setColor(Color.TRANSPARENT)
                setStroke(dp(2), Color.WHITE)
            }
            setOnClickListener {
                startService(Intent(this@AlarmActivity, RingService::class.java).setAction(AlarmScheduler.ACTION_SNOOZE))
                finish()
            }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            addView(
                timeView,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT),
            )
            addView(
                subtitle,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = dp(16) },
            )
            addView(
                stopButton,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(120))
                    .apply { setMargins(dp(24), dp(48), dp(24), 0) },
            )
            addView(
                snoozeButton,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(72))
                    .apply { setMargins(dp(24), dp(16), dp(24), 0) },
            )
        }
        setContentView(root)
        rootView = root
        subtitleView = subtitle
        lightTick.run()
        clockTick.run()
    }

    /** Back is ignored on purpose: the Stop button is the only way out. */
    @Suppress("DEPRECATION", "MissingSuperCall")
    override fun onBackPressed() {
        // intentionally empty
    }

    private fun onStopClicked() {
        startService(Intent(this, RingService::class.java).setAction(AlarmScheduler.ACTION_STOP))
        packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(launch)
        }
        finish()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (current?.get() === this) current = null
        super.onDestroy()
    }
}
