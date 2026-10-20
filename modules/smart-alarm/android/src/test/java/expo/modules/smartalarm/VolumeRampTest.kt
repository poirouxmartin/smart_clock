package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class VolumeRampTest {

    private val ramp = 60_000L
    private val start = 0.02f

    @Test
    fun startsAtStartVolume() {
        assertEquals(start, VolumeRamp.volume(0L, ramp, start), 1e-6f)
    }

    @Test
    fun endsAtEndVolume() {
        assertEquals(1f, VolumeRamp.volume(ramp, ramp, start), 1e-5f)
        assertEquals(1f, VolumeRamp.volume(ramp * 3, ramp, start), 1e-5f)
    }

    @Test
    fun negativeElapsedClampsToStart() {
        assertEquals(start, VolumeRamp.volume(-5_000L, ramp, start), 1e-6f)
    }

    @Test
    fun midpointIsGeometricMean() {
        val mid = VolumeRamp.volume(ramp / 2, ramp, start)
        assertEquals(Math.sqrt(start.toDouble() * 1.0).toFloat(), mid, 1e-5f)
    }

    @Test
    fun isMonotonicNonDecreasing() {
        var previous = VolumeRamp.volume(0L, ramp, start)
        for (step in 1..60) {
            val current = VolumeRamp.volume(step * 1_000L, ramp, start)
            assertTrue("step $step decreased", current >= previous)
            previous = current
        }
    }

    @Test
    fun zeroStartIsClampedAndStillRises() {
        val v = VolumeRamp.volume(ramp / 2, ramp, 0f)
        assertTrue(v > 0f)
        assertTrue(v < 1f)
    }

    @Test
    fun nonPositiveRampReturnsEnd() {
        assertEquals(1f, VolumeRamp.volume(0L, 0L, start), 1e-6f)
    }
}
