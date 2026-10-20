package expo.modules.smartalarm

/** Usual bedtime from recent sleep-onset minutes of day, no Android dependencies. */
object UsualBedtime {
    const val DEFAULT_MINUTE = 23 * 60

    private const val MINUTES_PER_DAY = 1440
    private const val HALF_DAY = 720
    private const val MAX_SAMPLES = 14

    /** Median of the last MAX_SAMPLES onsets, taken on a noon-pivoted clock so 23:30 and 00:30 are neighbours. */
    fun estimate(onsetMinutes: List<Int>): Int {
        if (onsetMinutes.isEmpty()) return DEFAULT_MINUTE
        val shifted = onsetMinutes.takeLast(MAX_SAMPLES)
            .map { Math.floorMod(it + HALF_DAY, MINUTES_PER_DAY) }
            .sorted()
        val n = shifted.size
        val median = if (n % 2 == 1) shifted[n / 2] else (shifted[n / 2 - 1] + shifted[n / 2]) / 2
        return Math.floorMod(median - HALF_DAY, MINUTES_PER_DAY)
    }
}
