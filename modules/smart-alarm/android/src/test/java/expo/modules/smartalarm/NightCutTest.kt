package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Night of 20-21/11/2026: tracking stopped after about two hours, then no ring and no stats.
 * When Android kills the process without restarting the sticky service (OEM battery manager,
 * "Close app", repeated crashes), the night became a ghost: state TRACKING, no sensor data, and
 * nothing looked at it until the app was opened again. Only automatic nights had periodic probes,
 * and only until the wake window; a manual night (Home button, widget) had no watchdog at all.
 */
class NightCutTest {

    private val min = 60_000L
    private val now = 1_763_679_600_000L // 2026-11-20 ~23:00
    private val target = now + 8 * 60 * min
    private val windowStart = target - 30 * min

    @Test
    fun manualNightIsWatched() {
        val next = AlarmPolicy.trackingCheckAt(isAuto = false, nowMs = now, windowStartMs = windowStart, targetAtMs = target)
        assertNotNull("a manual night needs a watchdog check", next)
        assertEquals(now + AlarmPolicy.NIGHT_CHECK_MS, next)
    }

    @Test
    fun automaticNightIsWatchedInsideTheWindow() {
        val inWindow = windowStart + 5 * min
        assertEquals(
            inWindow + AlarmPolicy.NIGHT_CHECK_MS,
            AlarmPolicy.trackingCheckAt(isAuto = true, nowMs = inWindow, windowStartMs = windowStart, targetAtMs = target),
        )
    }

    @Test
    fun lastCheckIsClampedToTheTarget() {
        val late = target - 5 * min
        assertEquals(target, AlarmPolicy.trackingCheckAt(isAuto = false, nowMs = late, windowStartMs = windowStart, targetAtMs = target))
    }

    @Test
    fun noCheckAfterTheTarget() {
        assertNull(AlarmPolicy.trackingCheckAt(isAuto = false, nowMs = target, windowStartMs = windowStart, targetAtMs = target))
    }

    // The watchdog must run for manual nights too: onProbe used to return at once when auto mode was off.
    @Test
    fun probeRepairsNightEvenWithAutoModeOff() {
        val src = File("src/main/java/expo/modules/smartalarm/AutoManager.kt").readText()
        val body = src.substringAfter("fun onProbe(").substringBefore("AutoStore.addProbe")
        val repairAt = body.indexOf("NightSession.repair")
        val autoGuardAt = body.indexOf("if (!AutoStore.enabled(ctx)) return")
        assertTrue("onProbe must repair the night before any auto-mode guard", repairAt >= 0 && (autoGuardAt < 0 || repairAt < autoGuardAt))
    }

    // Starting a night must arm the watchdog right away, not only the fallback alarm.
    @Test
    fun startingANightArmsTheWatchdog() {
        val src = File("src/main/java/expo/modules/smartalarm/NightSession.kt").readText()
        val start = src.substringAfter("fun start(").substringBefore("fun cancel(")
        assertTrue("NightSession.start must schedule the night check", start.contains("AutoManager.scheduleNightCheck"))
    }
}
