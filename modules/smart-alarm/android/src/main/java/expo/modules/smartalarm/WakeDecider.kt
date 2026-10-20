package expo.modules.smartalarm

import kotlin.math.max
import kotlin.math.min

/** Pure wake decision logic, no Android dependencies. */
object WakeDecider {
    const val MIN_ACTIVITY = 1.0
    const val SETTLE_EPOCHS = 15
    const val PERCENTILE = 0.90
    const val NOISE_FLOOR = 0.02
    const val CYCLE_BONUS = 0.85
    const val CYCLE_MIN = 90
    const val CYCLE_TOLERANCE_MIN = 15
    const val SUSTAINED_RATIO = 0.6
    const val API_AWAKE_CONFIDENCE = 30
    const val API_MIN_RATIO = 0.3

    /** Threshold from the night's history; the first SETTLE_EPOCHS epochs are ignored. */
    fun threshold(history: List<Double>): Double =
        if (history.size <= SETTLE_EPOCHS) MIN_ACTIVITY
        else max(MIN_ACTIVITY, percentile(history.drop(SETTLE_EPOCHS), PERCENTILE))

    /** Nearest-rank percentile on a sorted copy. Requires a non-empty list. */
    private fun percentile(values: List<Double>, p: Double): Double {
        val sorted = values.sorted()
        val rank = Math.ceil(p * sorted.size).toInt().coerceIn(1, sorted.size)
        return sorted[rank - 1]
    }

    /** Threshold multiplier: CYCLE_BONUS within CYCLE_TOLERANCE_MIN of a sleep-cycle boundary after onset. */
    fun cycleFactor(nowMs: Long, onsetMs: Long?): Double {
        if (onsetMs == null || nowMs <= onsetMs) return 1.0
        val phase = ((nowMs - onsetMs) / 60_000L % CYCLE_MIN).toInt()
        return if (min(phase, CYCLE_MIN - phase) <= CYCLE_TOLERANCE_MIN) CYCLE_BONUS else 1.0
    }

    /**
     * Wake reason, or null to keep waiting. "movement": current epoch over threshold.
     * "sustained": 2 of the last 3 epochs at SUSTAINED_RATIO of threshold. "api": fresh Sleep API
     * says awake and current epoch shows some movement.
     */
    fun decide(
        nowMs: Long,
        windowStartMs: Long,
        targetMs: Long,
        historyBeforeWindow: List<Double>,
        recent: List<Double>,
        onsetMs: Long? = null,
        apiConfidence: Int? = null,
    ): String? {
        if (recent.isEmpty() || nowMs < windowStartMs || nowMs >= targetMs) return null
        val t = threshold(historyBeforeWindow) * cycleFactor(nowMs, onsetMs)
        val current = recent.last()
        if (current >= t) return "movement"
        val last3 = recent.takeLast(3)
        if (last3.size == 3 && last3.count { it >= SUSTAINED_RATIO * t } >= 2) return "sustained"
        if (apiConfidence != null && apiConfidence <= API_AWAKE_CONFIDENCE && current >= API_MIN_RATIO * t) return "api"
        return null
    }

    fun shouldWake(
        nowMs: Long,
        windowStartMs: Long,
        targetMs: Long,
        historyBeforeWindow: List<Double>,
        current: Double,
    ): Boolean = decide(nowMs, windowStartMs, targetMs, historyBeforeWindow, listOf(current)) != null

    /** Contribution of one sample's delta to an epoch's activity. */
    fun contribution(delta: Double): Double = max(0.0, delta - NOISE_FLOOR)

    fun activity(deltas: List<Double>): Double = deltas.sumOf { contribution(it) }
}
