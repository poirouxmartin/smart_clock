package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Night of 17-18/11/2026: "Commencer la nuit maintenant" disappeared and the night left no data.
 * Home hides that button whenever the stored state is TRACKING. A TRACKING state with no live
 * tracking service (a ghost night) kept it hidden, blocked automatic nights and recorded nothing.
 */
class GhostNightTest {

    private val min = 60_000L
    private val now = 1_763_420_000_000L

    // The tracking notification's "Arrêter le suivi" stopped the service but left state TRACKING.
    @Test
    fun notificationStopEndsTheNight() {
        val src = File("src/main/java/expo/modules/smartalarm/SleepTrackingService.kt").readText()
        val stopBranch = Regex("""ACTION_STOP_TRACKING\)\s*\{([^}]*)\}""").find(src)
        assertTrue("stop action branch not found", stopBranch != null)
        assertTrue(
            "the stop action must end the night (NightSession.cancel), not only stop the service",
            stopBranch!!.groupValues[1].contains("NightSession.cancel"),
        )
    }

    @Test
    fun deadServiceBeforeTargetIsRestarted() {
        assertEquals(
            AlarmPolicy.TrackingRepair.RESTART_SERVICE,
            AlarmPolicy.trackingRepair(AlarmStore.TRACKING, now + 6 * 60 * min, now, serviceAlive = false),
        )
    }

    @Test
    fun liveServiceIsLeftAlone() {
        assertEquals(
            AlarmPolicy.TrackingRepair.NONE,
            AlarmPolicy.trackingRepair(AlarmStore.TRACKING, now + 6 * 60 * min, now, serviceAlive = true),
        )
    }

    @Test
    fun ghostLongPastTargetIsClosed() {
        assertEquals(
            AlarmPolicy.TrackingRepair.CLOSE,
            AlarmPolicy.trackingRepair(AlarmStore.TRACKING, now - 2 * 60 * min, now, serviceAlive = false),
        )
    }

    @Test
    fun justPastTargetLeavesTheFallbackRingUnlessAfterBoot() {
        val target = now - 10 * min
        assertEquals(
            AlarmPolicy.TrackingRepair.NONE,
            AlarmPolicy.trackingRepair(AlarmStore.TRACKING, target, now, serviceAlive = false),
        )
        // After a reboot the fallback alarm is gone: ring late instead.
        assertEquals(
            AlarmPolicy.TrackingRepair.RING_LATE,
            AlarmPolicy.trackingRepair(AlarmStore.TRACKING, target, now, serviceAlive = false, afterBoot = true),
        )
    }

    @Test
    fun otherStatesAreNotTouched() {
        for (s in listOf(AlarmStore.IDLE, AlarmStore.RINGING, AlarmStore.DONE)) {
            assertEquals(AlarmPolicy.TrackingRepair.NONE, AlarmPolicy.trackingRepair(s, now - 5 * 60 * min, now, false))
        }
    }
}
