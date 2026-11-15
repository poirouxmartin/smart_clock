package expo.modules.smartalarm

import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Per-epoch movement accumulator. Works on the acceleration VECTOR (not its magnitude), so a pure tilt
 * of the phone (|a| constant) is seen. The noise floor adapts to the quietest epoch seen so far.
 * Not thread-safe: use from a single thread.
 */
class EpochAccumulator {

    companion object {
        const val EMA_ALPHA = 0.1
        const val MIN_NOISE_FLOOR = 0.03
        const val NOISE_FACTOR = 3.0
        const val MIN_SAMPLES_FOR_NOISE = 100
    }

    data class Result(val activity: Double, val maxDelta: Double, val samples: Int)

    private var gx = 0.0
    private var gy = 0.0
    private var gz = 0.0
    private var gravityInit = false

    private var deltas = DoubleArray(1280)
    private var samples = 0
    private var maxDelta = 0.0
    private var deviceNoise = Double.POSITIVE_INFINITY

    /** Floor used for the last closed epoch (or the current one before any adaptation). */
    var noiseFloor: Double = MIN_NOISE_FLOOR
        private set

    fun add(x: Double, y: Double, z: Double) {
        val d: Double
        if (!gravityInit) {
            gx = x; gy = y; gz = z
            gravityInit = true
            d = 0.0
        } else {
            val dx = x - gx
            val dy = y - gy
            val dz = z - gz
            d = sqrt(dx * dx + dy * dy + dz * dz)
            gx += EMA_ALPHA * dx
            gy += EMA_ALPHA * dy
            gz += EMA_ALPHA * dz
        }
        if (samples == deltas.size) deltas = deltas.copyOf(deltas.size * 2)
        deltas[samples++] = d
        maxDelta = max(maxDelta, d)
    }

    fun close(): Result {
        if (samples >= MIN_SAMPLES_FOR_NOISE) {
            val sorted = deltas.copyOf(samples).also { it.sort() }
            val median = if (samples % 2 == 1) sorted[samples / 2] else (sorted[samples / 2 - 1] + sorted[samples / 2]) / 2
            deviceNoise = min(deviceNoise, median)
        }
        noiseFloor = if (deviceNoise.isInfinite()) MIN_NOISE_FLOOR else max(MIN_NOISE_FLOOR, NOISE_FACTOR * deviceNoise)
        var activity = 0.0
        for (i in 0 until samples) activity += max(0.0, deltas[i] - noiseFloor)
        val result = Result(activity, maxDelta, samples)
        samples = 0
        maxDelta = 0.0
        return result
    }
}
