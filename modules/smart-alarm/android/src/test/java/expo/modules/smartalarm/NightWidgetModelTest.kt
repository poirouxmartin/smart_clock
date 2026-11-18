package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Test

class NightWidgetModelTest {
    private val now = 1_000_000L

    @Test fun ringingShowsRinging() {
        val m = NightWidgetModel.of(AlarmStore.RINGING, now + 10, now - 10, 5L, now)
        assertEquals(WidgetMode.RINGING, m.mode)
    }

    @Test fun trackingBeforeTargetShowsWindow() {
        val m = NightWidgetModel.of(AlarmStore.TRACKING, now + 100, now + 50, 5L, now)
        assertEquals(WidgetModel(WidgetMode.TRACKING, now + 50, now + 100), m)
    }

    @Test fun trackingPastTargetFallsBackToIdle() {
        val m = NightWidgetModel.of(AlarmStore.TRACKING, now - 1, now - 50, 777L, now)
        assertEquals(WidgetModel(WidgetMode.IDLE, 0L, 777L), m)
    }

    @Test fun idleShowsNextTarget() {
        val m = NightWidgetModel.of(AlarmStore.IDLE, 0L, 0L, 42L, now)
        assertEquals(WidgetModel(WidgetMode.IDLE, 0L, 42L), m)
    }

    @Test fun doneIsIdleWithoutNextTarget() {
        val m = NightWidgetModel.of(AlarmStore.DONE, now + 5, now, null, now)
        assertEquals(WidgetModel(WidgetMode.IDLE, 0L, 0L), m)
    }
}
