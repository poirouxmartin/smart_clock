package expo.modules.smartalarm

import java.util.Random
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EpochAccumulatorTest {

    private val g = 9.81
    private val perEpoch = 1200 // 20 Hz * 60 s

    private fun noise(r: Random, sd: Double) = r.nextGaussian() * sd

    /** One epoch of samples; [pose] gives the noiseless (x, y, z) at sample i. */
    private fun epoch(r: Random, sd: Double, pose: (Int) -> Triple<Double, Double, Double>): List<Triple<Double, Double, Double>> =
        (0 until perEpoch).map { i ->
            val (x, y, z) = pose(i)
            Triple(x + noise(r, sd), y + noise(r, sd), z + noise(r, sd))
        }

    private fun still(): (Int) -> Triple<Double, Double, Double> = { Triple(0.0, 0.0, g) }

    private fun runNew(samples: List<Triple<Double, Double, Double>>, acc: EpochAccumulator = EpochAccumulator()): EpochAccumulator.Result {
        samples.forEach { (x, y, z) -> acc.add(x, y, z) }
        return acc.close()
    }

    /** Exactly the previous implementation: magnitude minus its EMA. */
    private fun runOld(samples: List<Triple<Double, Double, Double>>): Double {
        var gravity = 0.0
        var init = false
        var activity = 0.0
        for ((x, y, z) in samples) {
            val m = sqrt(x * x + y * y + z * z)
            if (!init) {
                gravity = m
                init = true
            } else {
                gravity = 0.9 * gravity + 0.1 * m
            }
            activity += WakeDecider.contribution(abs(m - gravity))
        }
        return activity
    }

    @Test
    fun stillPhoneIsCalm() {
        val r = Random(1)
        val res = runNew(epoch(r, 0.01, still()))
        assertEquals(perEpoch, res.samples)
        assertTrue("activity=${res.activity}", res.activity < 1.0)
    }

    @Test
    fun tiltWithConstantMagnitudeIsMovement() {
        val r = Random(2)
        val tilt = Math.toRadians(30.0)
        val samples = epoch(r, 0.01) { i ->
            // Still, then 2 s (40 samples) rotating 30 degrees around x, then held tilted.
            val a = when {
                i < 600 -> 0.0
                i < 640 -> tilt * (i - 600) / 40.0
                else -> tilt
            }
            Triple(0.0, -g * sin(a), g * cos(a))
        }
        val old = runOld(samples)
        val new = runNew(samples)
        println("tilt: old=$old new=${new.activity} maxDelta=${new.maxDelta}")
        assertTrue("old=$old", old < 1.0)
        assertTrue("new=${new.activity}", new.activity >= 1.0)
    }

    @Test
    fun smallVerticalJoltIsMovement() {
        val r = Random(3)
        val samples = epoch(r, 0.01) { i -> Triple(0.0, 0.0, if (i in 600 until 620) g + 0.3 else g) }
        val res = runNew(samples)
        assertTrue("activity=${res.activity}", res.activity >= 1.0)
    }

    @Test
    fun zeroSamples() {
        assertEquals(EpochAccumulator.Result(0.0, 0.0, 0), EpochAccumulator().close())
    }

    @Test
    fun noiseFloorAdaptsToNoisierSensor() {
        val r = Random(4)
        val acc = EpochAccumulator()
        val first = runNew(epoch(r, 0.03, still()), acc)
        val second = runNew(epoch(r, 0.03, still()), acc)
        println("noisy: first=${first.activity} second=${second.activity} floor=${acc.noiseFloor}")
        assertTrue("second=${second.activity}", second.activity < 1.0)
        assertTrue(acc.noiseFloor > EpochAccumulator.MIN_NOISE_FLOOR)
    }
}
