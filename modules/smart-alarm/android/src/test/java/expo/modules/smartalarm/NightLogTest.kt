package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Test

class NightLogTest {
    @Test
    fun trimKeepsTheLastLines() {
        val lines = (1..5).map { "l$it" }
        assertEquals(listOf("l3", "l4", "l5"), NightLog.trim(lines, 3))
    }

    @Test
    fun trimLeavesShortListsAlone() {
        val lines = listOf("a", "b")
        assertEquals(lines, NightLog.trim(lines, 3))
    }

    @Test
    fun reasonNamesMapKnownCodes() {
        assertEquals("EXIT_SELF", NightLog.reasonName(1))
        assertEquals("LOW_MEMORY", NightLog.reasonName(3))
        assertEquals("USER_REQUESTED", NightLog.reasonName(10))
        assertEquals("FREEZER", NightLog.reasonName(14))
        assertEquals("PACKAGE_UPDATED", NightLog.reasonName(16))
    }

    @Test
    fun unknownReasonFallsBackToTheNumber() {
        assertEquals("99", NightLog.reasonName(99))
    }
}
