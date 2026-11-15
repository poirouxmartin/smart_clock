package expo.modules.smartalarm

import kotlin.math.ceil
import kotlin.math.roundToInt

/** Dawn ramp: progress, brightness, colour and torch level, no Android dependencies. */
object DawnCurve {
    const val MIN_BRIGHTNESS = 0.01f

    private const val TORCH_START = 0.8
    private val KEYS = doubleArrayOf(0.0, 0.3, 0.55, 0.8, 1.0)
    private val COLORS = intArrayOf(0x1A0500, 0x5A1400, 0xB83A00, 0xFF9A3C, 0xFFE6B0)

    /** Linear progress 0..1 of nowMs within [startMs, endMs]; 1.0 if the window is empty. */
    fun progress(nowMs: Long, startMs: Long, endMs: Long): Double {
        if (endMs <= startMs) return 1.0
        return ((nowMs - startMs).toDouble() / (endMs - startMs)).coerceIn(0.0, 1.0)
    }

    /** Ring-screen progress: from startP up to 1 over rampMs; 1.0 if rampMs <= 0. */
    fun ringProgress(startP: Double, elapsedMs: Long, rampMs: Long): Double {
        if (rampMs <= 0) return 1.0
        val s = startP.coerceIn(0.0, 1.0)
        val f = (maxOf(elapsedMs, 0L).toDouble() / rampMs).coerceAtMost(1.0)
        return s + (1.0 - s) * f
    }

    /** Screen brightness, quadratic ramp from MIN_BRIGHTNESS to 1. */
    fun brightness(p: Double): Float = MIN_BRIGHTNESS + (1f - MIN_BRIGHTNESS) * (p * p).toFloat()

    /** ARGB colour, linear RGB interpolation between keyframes; p is clamped to 0..1. */
    fun color(p: Double): Int {
        val x = p.coerceIn(0.0, 1.0)
        var i = 0
        while (i < KEYS.size - 2 && x > KEYS[i + 1]) i++
        val f = (x - KEYS[i]) / (KEYS[i + 1] - KEYS[i])
        val a = COLORS[i]
        val b = COLORS[i + 1]
        val r = lerp((a shr 16) and 0xFF, (b shr 16) and 0xFF, f)
        val g = lerp((a shr 8) and 0xFF, (b shr 8) and 0xFF, f)
        val bl = lerp(a and 0xFF, b and 0xFF, f)
        return (0xFF shl 24) or (r shl 16) or (g shl 8) or bl
    }

    private fun lerp(from: Int, to: Int, f: Double): Int = (from + (to - from) * f).roundToInt()

    /** Torch steps 1..maxLevel once p reaches TORCH_START; 0 before that or when maxLevel < 1. */
    fun torchLevel(p: Double, maxLevel: Int): Int {
        if (maxLevel < 1 || p < TORCH_START) return 0
        return ceil((p - TORCH_START) / 0.2 * maxLevel).toInt().coerceIn(1, maxLevel)
    }
}
