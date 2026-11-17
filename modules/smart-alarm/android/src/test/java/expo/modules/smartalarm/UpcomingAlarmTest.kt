package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UpcomingAlarmTest {

    private val now = 1_000_000L
    private val target = now + 3_600_000L

    @Test
    fun shownWhenArmedAndIdle() {
        assertEquals(target, UpcomingAlarm.targetToShow(true, true, AlarmStore.IDLE, target, now))
    }

    @Test
    fun hiddenWhenAutoDisabled() {
        assertNull(UpcomingAlarm.targetToShow(false, true, AlarmStore.IDLE, target, now))
    }

    @Test
    fun hiddenWhenNotificationDisabled() {
        assertNull(UpcomingAlarm.targetToShow(true, false, AlarmStore.IDLE, target, now))
    }

    @Test
    fun hiddenWhileTrackingOrRinging() {
        assertNull(UpcomingAlarm.targetToShow(true, true, AlarmStore.TRACKING, target, now))
        assertNull(UpcomingAlarm.targetToShow(true, true, AlarmStore.RINGING, target, now))
    }

    @Test
    fun hiddenWhenTargetNotInFuture() {
        assertNull(UpcomingAlarm.targetToShow(true, true, AlarmStore.IDLE, now, now))
    }
}
