package expo.modules.smartalarm

import kotlin.math.max

/** Pure wake decision logic, no Android dependencies. */
object WakeDecider {
    const val MIN_ACTIVITY = 1.0
    const val SETTLE_EPOCHS = 15
    const val PERCENTILE = 0.90
    const val NOISE_FLOOR = 0.02

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

    fun shouldWake(
        nowMs: Long,
        windowStartMs: Long,
        targetMs: Long,
        historyBeforeWindow: List<Double>,
        current: Double,
    ): Boolean =
        nowMs >= windowStartMs && nowMs < targetMs && current >= threshold(historyBeforeWindow)

    /** Contribution of one sample's delta to an epoch's activity. */
    fun contribution(delta: Double): Double = max(0.0, delta - NOISE_FLOOR)

    fun activity(deltas: List<Double>): Double = deltas.sumOf { contribution(it) }
}
