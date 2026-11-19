package expo.modules.smartalarm

/** Pure snooze rules, kept free of Android types so they are unit-testable. */
object Snooze {
    const val MINUTES = 9

    /** First ring of the morning: fades in from almost silent (RingService). */
    const val WAKE_START_VOLUME = 0.02f

    /** Re-ring after a snooze: starts clearly audible, short fade-in. */
    const val SNOOZE_START_VOLUME = 0.3f
    const val SNOOZE_RAMP_MS = 15_000L

    fun triggerAt(nowMs: Long, minutes: Int = MINUTES): Long = nowMs + minutes * 60_000L

    /** A snoozed test stays a test (no night state touched); anything else becomes "snooze". */
    fun nextReason(reason: String): String = if (reason == "test") "test" else "snooze"

    /**
     * Whether a Snooze tap (alarm screen, notification action or in-app button: all three send
     * ACTION_SNOOZE to RingService) must schedule a new ring.
     */
    fun acceptsSnooze(serviceRinging: Boolean, state: String): Boolean =
        serviceRinging || state == AlarmStore.RINGING

    /** How a ring starts: volume at t=0, fade-in length, and when vibration joins. */
    data class RingStart(val startVolume: Float, val rampMs: Long, val vibrateAfterMs: Long)

    fun ringStart(reason: String, rampMs: Long): RingStart =
        if (reason == "snooze") {
            // The sleeper already woke once: come back audible at once, short ramp, vibrate now.
            RingStart(SNOOZE_START_VOLUME, minOf(rampMs, SNOOZE_RAMP_MS), 0L)
        } else {
            RingStart(WAKE_START_VOLUME, rampMs, rampMs)
        }

    /** What AlarmReceiver does when the system refuses to start RingService from the background. */
    enum class Refused { NOTHING, FULL_SCREEN_NOTIFICATION }

    fun onRingStartRefused(reason: String): Refused = Refused.FULL_SCREEN_NOTIFICATION
}
