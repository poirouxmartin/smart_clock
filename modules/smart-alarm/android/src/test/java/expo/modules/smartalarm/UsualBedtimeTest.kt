package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Test

class UsualBedtimeTest {

    @Test
    fun emptyHistoryUsesDefault() {
        assertEquals(UsualBedtime.DEFAULT_MINUTE, UsualBedtime.estimate(emptyList()))
    }

    @Test
    fun medianAcrossMidnight() {
        // 23:30, 00:30, 00:00 -> 00:00
        assertEquals(0, UsualBedtime.estimate(listOf(23 * 60 + 30, 30, 0)))
    }

    @Test
    fun medianOfOneEveningCluster() {
        assertEquals(23 * 60, UsualBedtime.estimate(listOf(22 * 60 + 50, 23 * 60, 23 * 60 + 10)))
    }

    @Test
    fun evenCountAveragesMiddleTwo() {
        // 20:00 and 21:00 -> 20:30
        assertEquals(20 * 60 + 30, UsualBedtime.estimate(listOf(20 * 60, 21 * 60)))
    }

    @Test
    fun onlyLastFourteenSamplesCount() {
        // six old values at 10:00 are dropped, the last 14 are all 23:00
        val history = List(20) { i -> if (i < 6) 10 * 60 else 23 * 60 }
        assertEquals(23 * 60, UsualBedtime.estimate(history))
    }
}
