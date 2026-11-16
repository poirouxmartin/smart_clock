package expo.modules.smartalarm

/** Pure snooze rules, kept free of Android types so they are unit-testable. */
object Snooze {
    const val MINUTES = 9

    fun triggerAt(nowMs: Long, minutes: Int = MINUTES): Long = nowMs + minutes * 60_000L

    /** A snoozed test stays a test (no night state touched); anything else becomes "snooze". */
    fun nextReason(reason: String): String = if (reason == "test") "test" else "snooze"
}
