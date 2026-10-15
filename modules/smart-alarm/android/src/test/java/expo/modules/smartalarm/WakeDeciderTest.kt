package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WakeDeciderTest {

    private val target = 1_000_000_000L
    private val windowStart = target - 30 * 60_000L

    @Test
    fun outsideWindowDoesNotWake() {
        assertFalse(WakeDecider.shouldWake(windowStart - 1, windowStart, target, emptyList(), 100.0))
    }

    @Test
    fun stillNightSmallBlipDoesNotWake() {
        assertFalse(WakeDecider.shouldWake(windowStart + 1_000, windowStart, target, emptyList(), 0.5))
    }

    @Test
    fun movementAboveThresholdInWindowWakes() {
        assertTrue(WakeDecider.shouldWake(windowStart + 1_000, windowStart, target, emptyList(), 2.0))
    }

    @Test
    fun restlessNightRaisesThreshold() {
        val history = List(30) { 5.0 }
        assertEquals(5.0, WakeDecider.threshold(history), 1e-9)
        assertFalse(WakeDecider.shouldWake(windowStart + 1_000, windowStart, target, history, 3.0))
        assertTrue(WakeDecider.shouldWake(windowStart + 1_000, windowStart, target, history, 6.0))
    }

    @Test
    fun emptyHistoryUsesMinActivity() {
        assertEquals(WakeDecider.MIN_ACTIVITY, WakeDecider.threshold(emptyList()), 1e-9)
    }

    @Test
    fun atOrAfterTargetDoesNotWake() {
        assertFalse(WakeDecider.shouldWake(target, windowStart, target, emptyList(), 100.0))
        assertFalse(WakeDecider.shouldWake(target + 1, windowStart, target, emptyList(), 100.0))
    }

    @Test
    fun activityIgnoresNoiseBelowFloor() {
        assertEquals(0.0, WakeDecider.activity(listOf(0.01, 0.02, 0.0, 0.015)), 1e-9)
        assertEquals(0.6, WakeDecider.activity(listOf(0.12, 0.52)), 1e-9)
    }
}
