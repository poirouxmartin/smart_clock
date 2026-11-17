package expo.modules.smartalarm

import java.util.Calendar
import java.util.TimeZone

/** Next automatic alarm time from a weekly mask, no Android dependencies. */
object AutoSchedule {
    private const val LEAD_MS = 60_000L
    private const val MAX_DAYS = 8
    private const val ALL_DAYS = 0x7F

    /**
     * Next occurrence of hour:minute strictly later than nowMs + 1 min on an enabled day.
     * daysMask bit0 = Monday ... bit6 = Sunday. Null if no day is enabled.
     */
    fun nextTargetMs(
        nowMs: Long,
        hour: Int,
        minute: Int,
        daysMask: Int,
        tz: TimeZone = TimeZone.getDefault(),
    ): Long? {
        val mask = daysMask and ALL_DAYS
        if (mask == 0) return null
        val earliest = nowMs + LEAD_MS
        for (offset in 0 until MAX_DAYS) {
            val cal = Calendar.getInstance(tz)
            cal.timeInMillis = nowMs
            cal.add(Calendar.DAY_OF_MONTH, offset)
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, minute)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            val bit = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7
            if (((mask shr bit) and 1) == 1 && cal.timeInMillis > earliest) return cal.timeInMillis
        }
        return null
    }

    /** Like [nextTargetMs] but returns the occurrence after skippedMs when the next one is the skipped one. */
    fun nextTargetSkipping(
        nowMs: Long,
        hour: Int,
        minute: Int,
        daysMask: Int,
        skippedMs: Long,
        tz: TimeZone = TimeZone.getDefault(),
    ): Long? {
        val next = nextTargetMs(nowMs, hour, minute, daysMask, tz) ?: return null
        return if (next == skippedMs) nextTargetMs(skippedMs, hour, minute, daysMask, tz) else next
    }

    /** Minute of day (0..1439) of tMs in the given zone. */
    fun minuteOfDay(tMs: Long, tz: TimeZone = TimeZone.getDefault()): Int {
        val cal = Calendar.getInstance(tz)
        cal.timeInMillis = tMs
        return cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    }
}
