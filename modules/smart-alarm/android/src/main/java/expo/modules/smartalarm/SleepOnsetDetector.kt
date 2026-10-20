package expo.modules.smartalarm

import kotlin.math.min

/** One sample of sleep signals at time tMs. */
data class SleepProbe(
    val tMs: Long,
    val screenOn: Boolean,
    val charging: Boolean,
    val motion: Double?,  // mean |accel magnitude - gravity| in m/s^2 over a ~5 s burst; null = no sensor
    val lux: Float?,      // ambient light, null = no sensor
    val apiConfidence: Int?,  // fresh Sleep API confidence 0..100, null = none
)

/** Sleep onset and wake-up scoring from probes, no Android dependencies. */
object SleepOnsetDetector {
    const val STILL_MOTION = 0.08
    const val DARK_LUX = 15f
    const val DIM_LUX = 50f
    const val SLEEP_SCORE = 0.6
    const val AWAKE_SCORE = 0.3
    const val CONFIRM_PROBES = 2

    private const val MINUTES_PER_DAY = 1440
    private const val W_API = 0.45
    private const val W_STILL = 0.25
    private const val W_DARK = 0.15
    private const val W_CHARGING = 0.05
    private const val W_PRIOR = 0.10
    private const val PRIOR_FULL_MIN = 60
    private const val PRIOR_ZERO_MIN = 240
    private const val DETECT_BEFORE_BED_MIN = 180
    private const val DETECT_BEFORE_TARGET_MIN = 60

    /** Distance between two minutes of day on the 24 h circle, 0..720. */
    fun circularDistanceMin(a: Int, b: Int): Int {
        val d = Math.floorMod(a - b, MINUTES_PER_DAY)
        return min(d, MINUTES_PER_DAY - d)
    }

    /** Sleep likelihood 0..1 for one probe; screen on vetoes to 0. Missing sensors are left out of the mean. */
    fun score(p: SleepProbe, minuteOfDay: Int, usualBedMinute: Int): Double {
        if (p.screenOn) return 0.0
        var sum = 0.0
        var weight = 0.0
        p.apiConfidence?.let {
            sum += W_API * (it / 100.0).coerceIn(0.0, 1.0)
            weight += W_API
        }
        p.motion?.let {
            val s = when {
                it < STILL_MOTION -> 1.0
                it < 2 * STILL_MOTION -> 0.5
                else -> 0.0
            }
            sum += W_STILL * s
            weight += W_STILL
        }
        p.lux?.let {
            val s = when {
                it < DARK_LUX -> 1.0
                it < DIM_LUX -> 0.5
                else -> 0.0
            }
            sum += W_DARK * s
            weight += W_DARK
        }
        sum += if (p.charging) W_CHARGING else 0.0
        weight += W_CHARGING
        val d = circularDistanceMin(minuteOfDay, usualBedMinute)
        val prior = when {
            d <= PRIOR_FULL_MIN -> 1.0
            d >= PRIOR_ZERO_MIN -> 0.0
            else -> (PRIOR_ZERO_MIN - d).toDouble() / (PRIOR_ZERO_MIN - PRIOR_FULL_MIN)
        }
        sum += W_PRIOR * prior
        weight += W_PRIOR
        return (sum / weight).coerceIn(0.0, 1.0)
    }

    /** tMs starting the run of asleep probes that ends at the last probe, once the last CONFIRM_PROBES are asleep; else null. */
    fun onset(probes: List<SleepProbe>, minuteOfDay: (Long) -> Int, usualBedMinute: Int): Long? {
        val sorted = probes.sortedBy { it.tMs }
        val scores = sorted.map { score(it, minuteOfDay(it.tMs), usualBedMinute) }
        if (scores.size < CONFIRM_PROBES) return null
        if (scores.takeLast(CONFIRM_PROBES).any { it < SLEEP_SCORE }) return null
        var i = scores.size - 1
        while (i > 0 && scores[i - 1] >= SLEEP_SCORE) i--
        return sorted[i].tMs
    }

    /** True if the last probe has the screen on, or the last two probes both score below AWAKE_SCORE. */
    fun isAwake(probes: List<SleepProbe>, minuteOfDay: (Long) -> Int, usualBedMinute: Int): Boolean {
        if (probes.isEmpty()) return false
        val sorted = probes.sortedBy { it.tMs }
        if (sorted.last().screenOn) return true
        if (sorted.size < 2) return false
        return sorted.takeLast(2).all { score(it, minuteOfDay(it.tMs), usualBedMinute) < AWAKE_SCORE }
    }

    /** True if minuteOfDay is in [usualBed - 180, target - 60) mod 1440, wrapping past midnight. */
    fun inDetectionPeriod(minuteOfDay: Int, usualBedMinute: Int, targetMinute: Int): Boolean {
        val start = Math.floorMod(usualBedMinute - DETECT_BEFORE_BED_MIN, MINUTES_PER_DAY)
        val end = Math.floorMod(targetMinute - DETECT_BEFORE_TARGET_MIN, MINUTES_PER_DAY)
        return if (start <= end) minuteOfDay in start until end else minuteOfDay >= start || minuteOfDay < end
    }
}
