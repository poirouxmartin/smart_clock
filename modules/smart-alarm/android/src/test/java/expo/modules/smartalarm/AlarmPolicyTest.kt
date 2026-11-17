package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.Calendar
import java.util.TimeZone

class AlarmPolicyTest {

    private val paris = TimeZone.getTimeZone("Europe/Paris")
    private val everyDay = 0x7F
    private val min = 60_000L

    private fun ms(y: Int, mo: Int, d: Int, h: Int, mi: Int): Long {
        val c = Calendar.getInstance(paris)
        c.clear()
        c.set(y, mo - 1, d, h, mi, 0)
        return c.timeInMillis
    }

    // B1: a ring whose process died must not leave RINGING forever.
    @Test
    fun b1_deadRingIsStaleAfterGrace() {
        val fired = ms(2026, 11, 18, 7, 0)
        assertTrue(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, 0L, fired + 31 * min, serviceRinging = false))
        assertFalse(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, 0L, fired + 10 * min, serviceRinging = false))
    }

    @Test
    fun b1_liveRingOrPendingSnoozeIsKept() {
        val fired = ms(2026, 11, 18, 7, 0)
        val later = fired + 2 * 60 * min
        assertFalse(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, 0L, later, serviceRinging = true))
        assertFalse(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, later + 5 * min, later, serviceRinging = false))
        assertFalse(AlarmPolicy.isStaleRinging(AlarmStore.DONE, fired, 0L, later, serviceRinging = false))
    }

    @Test
    fun b1_afterBootNoGraceButSnoozeKept() {
        val fired = ms(2026, 11, 18, 7, 0)
        val boot = fired + 5 * min
        assertTrue(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, 0L, boot, false, afterBoot = true))
        assertFalse(AlarmPolicy.isStaleRinging(AlarmStore.RINGING, fired, boot + 4 * min, boot, false, afterBoot = true))
    }

    // B2: a smart wake at 6:40 for a 7:00 target must not ring again at 7:00.
    @Test
    fun b2_smartWakeBeforeTargetDoesNotRearmSameTarget() {
        val target = ms(2026, 11, 18, 7, 0)
        val fired = ms(2026, 11, 18, 6, 40)
        val plan = AlarmPolicy.planRearm(fired + min, 7, 0, everyDay, 0L, AlarmStore.DONE, fired, target, paris)
        assertEquals(AlarmPolicy.RearmPlan.Arm(ms(2026, 11, 19, 7, 0), clearProbes = true), plan)
    }

    @Test
    fun b2_oldRingDoesNotSkipTodaysTarget() {
        val target = ms(2026, 11, 18, 7, 0)
        val firedYesterday = ms(2026, 11, 17, 6, 50)
        val now = ms(2026, 11, 17, 22, 0)
        val plan = AlarmPolicy.planRearm(now, 7, 0, everyDay, 0L, AlarmStore.DONE, firedYesterday, target, paris)
        assertEquals(AlarmPolicy.RearmPlan.Arm(target, clearProbes = false), plan)
    }

    // B4: unchecking every day disarms instead of keeping a ghost alarm.
    @Test
    fun b4_noDayDisarms() {
        val now = ms(2026, 11, 17, 22, 0)
        val plan = AlarmPolicy.planRearm(now, 7, 0, 0, 0L, AlarmStore.IDLE, 0L, ms(2026, 11, 18, 7, 0), paris)
        assertEquals(AlarmPolicy.RearmPlan.Disarm, plan)
    }

    // B5: re-arming the same target (app opened at 23:00) keeps the evening probes.
    @Test
    fun b5_sameTargetKeepsProbes() {
        val target = ms(2026, 11, 18, 7, 0)
        val plan = AlarmPolicy.planRearm(ms(2026, 11, 17, 23, 0), 7, 0, everyDay, 0L, AlarmStore.IDLE, 0L, target, paris)
        assertEquals(AlarmPolicy.RearmPlan.Arm(target, clearProbes = false), plan)
    }

    @Test
    fun b5_newTargetClearsProbes() {
        val plan = AlarmPolicy.planRearm(ms(2026, 11, 17, 23, 0), 8, 0, everyDay, 0L, AlarmStore.IDLE, 0L, ms(2026, 11, 18, 7, 0), paris)
        assertEquals(AlarmPolicy.RearmPlan.Arm(ms(2026, 11, 18, 8, 0), clearProbes = true), plan)
    }

    // B3: the alarm path must run before the first unlock after a night reboot.
    @Test
    fun b3_alarmComponentsAreDirectBootAware() {
        val manifest = File("src/main/AndroidManifest.xml").readText()
        assertTrue(manifest.contains("android.intent.action.LOCKED_BOOT_COMPLETED"))
        for (name in listOf("BootReceiver", "AlarmReceiver", "RingService", "AlarmActivity", "DawnReceiver", "DawnActivity")) {
            val decl = Regex("android:name=\"expo\\.modules\\.smartalarm\\.$name\"\\s+android:directBootAware=\"true\"")
            assertTrue("$name must be directBootAware", decl.containsMatchIn(manifest))
        }
    }
}
