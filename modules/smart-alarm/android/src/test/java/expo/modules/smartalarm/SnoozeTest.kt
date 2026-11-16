package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Test

class SnoozeTest {

    @Test
    fun triggerAtAddsDefaultMinutes() {
        assertEquals(1_000L + 9 * 60_000L, Snooze.triggerAt(1_000L))
    }

    @Test
    fun triggerAtAddsGivenMinutes() {
        assertEquals(5 * 60_000L, Snooze.triggerAt(0L, 5))
    }

    @Test
    fun testRingStaysTest() {
        assertEquals("test", Snooze.nextReason("test"))
    }

    @Test
    fun realRingsBecomeSnooze() {
        assertEquals("snooze", Snooze.nextReason("smart"))
        assertEquals("snooze", Snooze.nextReason("fallback"))
        assertEquals("snooze", Snooze.nextReason("snooze"))
    }
}
