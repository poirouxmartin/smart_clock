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
    fun skipReturnsNextEnabledDay() {
        val now = ms(2026, 10, 20, 6, 0)
        val next = AutoSchedule.nextTargetSkipping(now, 7, 0, everyDay, ms(2026, 10, 20, 7, 0), paris)
        assertEquals(ms(2026, 10, 21, 7, 0), next)
    }

    @Test
    fun skipIgnoredWhenItDoesNotMatch() {
        val now = ms(2026, 10, 20, 6, 0)
        val next = AutoSchedule.nextTargetSkipping(now, 7, 30, everyDay, ms(2026, 10, 20, 7, 0), paris)
        assertEquals(ms(2026, 10, 20, 7, 30), next)
    }

    @Test
    fun skipWithSingleDayReturnsNextWeek() {
        // Tuesday only (0x02)
        val now = ms(2026, 10, 20, 6, 0)
        val next = AutoSchedule.nextTargetSkipping(now, 7, 0, 0x02, ms(2026, 10, 20, 7, 0), paris)
        assertEquals(ms(2026, 10, 27, 7, 0), next)
    }

    // Weekdays 07:00 (default), Saturday 09:30, Sunday off. Index 0 = Monday.
    private val weekdayDays = 0x1F or 0x20
    private val saturdayOverride = listOf(-1, -1, -1, -1, -1, 9 * 60 + 30, -1)

    @Test
    fun overrideAppliesToItsWeekday() {
        // Friday 2026-10-23 noon -> Saturday 09:30
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 23, 12, 0), 7, 0, weekdayDays, paris, saturdayOverride)
        assertEquals(ms(2026, 10, 24, 9, 30), next)
    }

    @Test
    fun dayOffSkippedToNextWeekday() {
        // Saturday 10:00 (after 09:30), Sunday off -> Monday 07:00
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 24, 10, 0), 7, 0, weekdayDays, paris, saturdayOverride)
        assertEquals(ms(2026, 10, 26, 7, 0), next)
    }

    @Test
    fun defaultTimeUsedWhenNoOverride() {
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 20, 6, 0), 7, 0, weekdayDays, paris, saturdayOverride)
        assertEquals(ms(2026, 10, 20, 7, 0), next)
    }

    @Test
    fun overrideEarlierThanNowRollsToNextEnabledDay() {
        // Tuesday override 06:00, now Tuesday 06:30 -> Wednesday default 07:00
        val tuesday = listOf(-1, 6 * 60, -1, -1, -1, -1, -1)
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 20, 6, 30), 7, 0, weekdayDays, paris, tuesday)
        assertEquals(ms(2026, 10, 21, 7, 0), next)
    }

    @Test
    fun skipWorksWithOverrides() {
        // Friday noon, Saturday 09:30 skipped -> Monday 07:00 (Sunday off)
        val now = ms(2026, 10, 23, 12, 0)
        val next = AutoSchedule.nextTargetSkipping(now, 7, 0, weekdayDays, ms(2026, 10, 24, 9, 30), paris, saturdayOverride)
        assertEquals(ms(2026, 10, 26, 7, 0), next)
    }

    @Test
    fun manualStartAllowsDayOffWithItsOverride() {
        // All days allowed (widget start), Sunday override 10:00
        val sunday = listOf(-1, -1, -1, -1, -1, -1, 10 * 60)
        val next = AutoSchedule.nextTargetMs(ms(2026, 10, 24, 22, 0), 7, 0, everyDay, paris, sunday)
        assertEquals(ms(2026, 10, 25, 10, 0), next)
    }

    @Test
    fun minuteOfDayUsesZone() {
        assertEquals(7 * 60 + 30, AutoSchedule.minuteOfDay(ms(2026, 10, 20, 7, 30), paris))
    }
}
