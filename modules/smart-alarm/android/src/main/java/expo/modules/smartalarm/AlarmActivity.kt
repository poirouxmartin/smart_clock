package expo.modules.smartalarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.Gravity
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.attributes = window.attributes.apply { screenBrightness = 1f }
        current = WeakReference(this)

        val reason = intent.getStringExtra(AlarmScheduler.EXTRA_REASON) ?: "fallback"

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
                    else -> R.string.ring_fallback
                }
            )
        }
        val stopButton = Button(this).apply {
            setText(R.string.stop)
            textSize = 24f
            setOnClickListener { onStopClicked() }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
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
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(96))
                    .apply { setMargins(dp(24), dp(48), dp(24), 0) },
            )
        }
        setContentView(root)
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
