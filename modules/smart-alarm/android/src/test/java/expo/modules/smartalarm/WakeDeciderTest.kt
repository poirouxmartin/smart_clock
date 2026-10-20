package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    @Test
    fun cycleBonusLowersThresholdAtCycleBoundary() {
        val history = List(30) { 5.0 }
        val now = windowStart + 1_000
        val atBoundary = now - 90 * 60_000L
        val midCycle = now - 45 * 60_000L
        assertEquals(WakeDecider.CYCLE_BONUS, WakeDecider.cycleFactor(now, atBoundary), 1e-9)
        assertEquals(1.0, WakeDecider.cycleFactor(now, midCycle), 1e-9)
        assertEquals(1.0, WakeDecider.cycleFactor(now, null), 1e-9)
        assertEquals("movement", WakeDecider.decide(now, windowStart, target, history, listOf(4.5), atBoundary))
        assertNull(WakeDecider.decide(now, windowStart, target, history, listOf(4.5), midCycle))
    }

    @Test
    fun sustainedRuleNeedsTwoOfLastThreeAboveRatio() {
        val now = windowStart + 1_000
        assertEquals("sustained", WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.1, 0.8, 0.9)))
        assertNull(WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.8, 0.9)))
        assertNull(WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.8, 0.1, 0.2)))
    }

    @Test
    fun apiRuleNeedsLowConfidenceAndSomeMovement() {
        val now = windowStart + 1_000
        assertEquals("api", WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.5), apiConfidence = 20))
        assertEquals("api", WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.3), apiConfidence = 30))
        assertNull(WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.5), apiConfidence = 31))
        assertNull(WakeDecider.decide(now, windowStart, target, emptyList(), listOf(0.2), apiConfidence = 20))
    }

    @Test
    fun decideReturnsNullOutsideWindowOrWithoutRecent() {
        assertNull(WakeDecider.decide(windowStart - 1, windowStart, target, emptyList(), listOf(100.0)))
        assertNull(WakeDecider.decide(target, windowStart, target, emptyList(), listOf(100.0)))
        assertNull(WakeDecider.decide(windowStart + 1, windowStart, target, emptyList(), emptyList()))
    }
}
