package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Snooze then re-ring, several times in a row, from each of the three Snooze buttons
 * (feedback of 2026-11-19: "after snooze, the alarm did not ring a second time").
 *
 * The simulator replays what RingService, AlarmScheduler and AlarmReceiver do, through the same
 * pure rules they call ([Snooze]).
 */
class SnoozeReRingTest {

    enum class Path { ALARM_SCREEN, NOTIFICATION, IN_APP }

    private class Phone(var fgsStartAllowed: Boolean = true) {
        var state = AlarmStore.TRACKING
        var serviceRinging = false
        var snoozeAt = 0L
        var volume = 0f
        var vibrating = false
        val rings = mutableListOf<String>()
        var fullScreenFallbacks = 0

        /** RingService.onStartCommand for a ring. */
        fun ring(reason: String, rampMs: Long = 60_000L) {
            if (serviceRinging) return
            serviceRinging = true
            snoozeAt = 0L
            if (reason != "test") state = AlarmStore.RINGING
            val start = Snooze.ringStart(reason, rampMs)
            volume = start.startVolume
            vibrating = start.vibrateAfterMs == 0L
            rings += reason
        }

        /** Any of the three Snooze buttons: they all send ACTION_SNOOZE to RingService. */
        fun tapSnooze(@Suppress("UNUSED_PARAMETER") path: Path, nowMs: Long) {
            if (Snooze.acceptsSnooze(serviceRinging, state)) {
                snoozeAt = Snooze.triggerAt(nowMs)
            }
            serviceRinging = false
            volume = 0f
            vibrating = false
        }

        /** AlarmManager fires the snooze alarm: AlarmReceiver.onFire("snooze"). */
        fun fireSnoozeIfDue(nowMs: Long) {
            if (snoozeAt == 0L || nowMs < snoozeAt) return
            if (fgsStartAllowed) {
                ring("snooze")
            } else if (Snooze.onRingStartRefused("snooze") == Snooze.Refused.FULL_SCREEN_NOTIFICATION) {
                // The full-screen notification opens AlarmActivity, which starts RingService from the foreground.
                fullScreenFallbacks++
                ring("snooze")
            }
        }
    }

    private fun snoozeThreeTimes(path: Path, phone: Phone = Phone()): Phone {
        var now = 1_000_000L
        phone.ring("smart")
        repeat(3) {
            now += 30_000L
            phone.tapSnooze(path, now)
            now += Snooze.MINUTES * 60_000L
            phone.fireSnoozeIfDue(now)
            assertTrue("re-ring ${it + 1} via $path must be ringing", phone.serviceRinging)
            assertTrue("re-ring ${it + 1} via $path must be audible at once (volume=${phone.volume})", phone.volume >= 0.25f)
            assertTrue("re-ring ${it + 1} via $path must vibrate at once", phone.vibrating)
        }
        return phone
    }

    @Test
    fun alarmScreenSnoozeRingsAgainThreeTimes() {
        assertEquals(listOf("smart", "snooze", "snooze", "snooze"), snoozeThreeTimes(Path.ALARM_SCREEN).rings)
    }

    @Test
    fun notificationSnoozeRingsAgainThreeTimes() {
        assertEquals(listOf("smart", "snooze", "snooze", "snooze"), snoozeThreeTimes(Path.NOTIFICATION).rings)
    }

    @Test
    fun inAppSnoozeRingsAgainThreeTimes() {
        assertEquals(listOf("smart", "snooze", "snooze", "snooze"), snoozeThreeTimes(Path.IN_APP).rings)
    }

    @Test
    fun reRingStillHappensWhenTheSystemRefusesABackgroundServiceStart() {
        val phone = snoozeThreeTimes(Path.NOTIFICATION, Phone(fgsStartAllowed = false))
        assertEquals(4, phone.rings.size)
        assertEquals(3, phone.fullScreenFallbacks)
    }

    @Test
    fun snoozeTapIsKeptWhenTheRingServiceLostItsRing() {
        // The ring service was restarted (process killed while ringing): it no longer knows it was
        // ringing, but the night is still RINGING. The tap must still schedule the re-ring.
        val phone = Phone()
        phone.ring("fallback")
        phone.serviceRinging = false
        phone.tapSnooze(Path.ALARM_SCREEN, 10_000L)
        phone.fireSnoozeIfDue(10_000L + Snooze.MINUTES * 60_000L)
        assertEquals(listOf("fallback", "snooze"), phone.rings)
    }

    @Test
    fun firstRingOfTheMorningStillFadesInFromSilence() {
        val start = Snooze.ringStart("smart", 60_000L)
        assertEquals(Snooze.WAKE_START_VOLUME, start.startVolume, 0f)
        assertEquals(60_000L, start.rampMs)
        assertEquals(60_000L, start.vibrateAfterMs)
    }

    @Test
    fun snoozeTapWhenNothingRingsIsIgnored() {
        assertTrue(!Snooze.acceptsSnooze(false, AlarmStore.DONE))
        assertTrue(!Snooze.acceptsSnooze(false, AlarmStore.IDLE))
    }
}
