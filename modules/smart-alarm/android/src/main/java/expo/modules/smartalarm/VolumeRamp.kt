package expo.modules.smartalarm

object VolumeRamp {
    private const val MIN_START = 0.001f

    /** Exponential (perceptual) ramp from [start] to [end] over [rampMs]. */
    fun volume(elapsedMs: Long, rampMs: Long, start: Float, end: Float = 1f): Float {
        if (rampMs <= 0L) return end
        val s = maxOf(start, MIN_START)
        val t = (elapsedMs.toDouble() / rampMs).coerceIn(0.0, 1.0)
        return (s * Math.pow((end / s).toDouble(), t)).toFloat()
    }
}
