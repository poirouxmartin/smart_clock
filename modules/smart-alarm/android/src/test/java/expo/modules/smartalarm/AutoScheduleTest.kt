package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class AutoScheduleTest {

    private val paris = TimeZone.getTimeZone("Europe/Paris")
    private val everyDay = 0x7F

    private fun ms(y: Int, mo: Int, d: Int, h: Int, mi: Int): Long {
        val c = Calendar.getInstance(paris)
        c.clear()
        c.set(y, mo - 1, d, h, mi, 0)
        return c.timeInMillis
    }

    @Test
    fun sameDayLaterWhenEnabled() {
        // Tuesday 2026-10-20, Tuesday bit = 0x02
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 20, 6, 0), 7, 0, 0x02, paris)
        assertEquals(ms(2026, 10, 20, 7, 0), next)
    }

    @Test
    fun exactlyNowPlusLeadIsSkipped() {
        // now is 07:00 exactly: 07:00 is not strictly later than now + 1 min
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 20, 7, 0), 7, 0, everyDay, paris)
        assertEquals(ms(2026, 10, 21, 7, 0), next)
    }

    @Test
    fun weekendOnlySkipsWeekdays() {
        // Friday 2026-10-23 noon, Saturday + Sunday = 0x20 | 0x40 = 0x60
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 23, 12, 0), 7, 0, 0x60, paris)
        assertEquals(ms(2026, 10, 24, 7, 0), next)
    }

    @Test
    fun mondayOnlyFromTuesdayWrapsToNextWeek() {
        // Tuesday 2026-10-20 10:00, Monday bit = 0x01 -> Monday 2026-10-26
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 20, 10, 0), 7, 0, 0x01, paris)
        assertEquals(ms(2026, 10, 26, 7, 0), next)
    }

    @Test
    fun emptyMaskReturnsNull() {
        assertNull(AutoSchedule.nextTargetMs(ms(2026, 10, 20, 6, 0), 7, 0, 0, paris))
    }

    @Test
    fun minuteOfDayUsesZone() {
        assertEquals(7 * 60 + 30, AutoSchedule.minuteOfDay(ms(2026, 10, 20, 7, 30), paris))
    }
}
