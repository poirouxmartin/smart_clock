package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SleepOnsetDetectorTest {

    private val bed = 23 * 60
    private val atBed: (Long) -> Int = { bed }

    private fun asleep(t: Long) = SleepProbe(t, screenOn = false, charging = true, motion = 0.01, lux = 5f, apiConfidence = 90)

    private fun restless(t: Long) = SleepProbe(t, screenOn = false, charging = false, motion = 1.0, lux = 300f, apiConfidence = 0)

    @Test
    fun circularDistanceWrapsMidnight() {
        assertEquals(20, SleepOnsetDetector.circularDistanceMin(1430, 10))
        assertEquals(720, SleepOnsetDetector.circularDistanceMin(0, 720))
        assertEquals(0, SleepOnsetDetector.circularDistanceMin(600, 600))
    }

    @Test
    fun screenOnVetoesScore() {
        val p = asleep(0L).copy(screenOn = true)
        assertEquals(0.0, SleepOnsetDetector.score(p, bed, bed), 1e-9)
    }

    @Test
    fun fullSensorsAtUsualBedtimeScoreOne() {
        assertEquals(1.0, SleepOnsetDetector.score(asleep(0L).copy(apiConfidence = 100), bed, bed), 1e-9)
    }

    @Test
    fun missingSensorsAreNormalisedOut() {
        // api 1.0 (w 0.45), charging 0 (w 0.05), prior 1.0 (w 0.10); motion and lux absent
        val onlyApi = SleepProbe(0L, screenOn = false, charging = false, motion = null, lux = null, apiConfidence = 100)
        assertEquals(0.55 / 0.60, SleepOnsetDetector.score(onlyApi, bed, bed), 1e-9)
        // charging 1 (w 0.05), prior 1.0 (w 0.10); no api, motion or lux
        val nothing = SleepProbe(0L, screenOn = false, charging = true, motion = null, lux = null, apiConfidence = null)
        assertEquals(1.0, SleepOnsetDetector.score(nothing, bed, bed), 1e-9)
    }

    @Test
    fun priorFallsLinearlyBetweenOneHourAndFourHours() {
        // distance 150 min: prior 0.5 (w 0.10); only charging 0 (w 0.05) present
        val p = SleepProbe(0L, screenOn = false, charging = false, motion = null, lux = null, apiConfidence = null)
        assertEquals(0.05 / 0.15, SleepOnsetDetector.score(p, bed + 150, bed), 1e-9)
    }

    @Test
    fun onsetIsStartOfConfirmedSleepRun() {
        val probes = listOf(restless(0L), asleep(1_000L), asleep(2_000L), asleep(3_000L))
        assertEquals(1_000L, SleepOnsetDetector.onset(probes, atBed, bed))
    }

    @Test
    fun onsetRunStartsAfterLastRestlessProbe() {
        val probes = listOf(asleep(0L), restless(1_000L), asleep(2_000L), asleep(3_000L))
        assertEquals(2_000L, SleepOnsetDetector.onset(probes, atBed, bed))
    }

    @Test
    fun onsetNeedsConfirmedSleepAtTheEnd() {
        assertNull(SleepOnsetDetector.onset(listOf(asleep(0L)), atBed, bed))
        assertNull(SleepOnsetDetector.onset(listOf(asleep(0L), restless(1_000L)), atBed, bed))
        assertNull(SleepOnsetDetector.onset(listOf(asleep(0L), asleep(1_000L), restless(2_000L)), atBed, bed))
    }

    @Test
    fun isAwakeOnScreenOrTwoRestlessProbes() {
        assertTrue(SleepOnsetDetector.isAwake(listOf(asleep(0L), asleep(1_000L).copy(screenOn = true)), atBed, bed))
        assertTrue(SleepOnsetDetector.isAwake(listOf(asleep(0L), restless(1_000L), restless(2_000L)), atBed, bed))
        assertFalse(SleepOnsetDetector.isAwake(listOf(asleep(0L), restless(1_000L)), atBed, bed))
        assertFalse(SleepOnsetDetector.isAwake(listOf(restless(0L)), atBed, bed))
        assertFalse(SleepOnsetDetector.isAwake(emptyList(), atBed, bed))
    }

    @Test
    fun detectionPeriodWrapsMidnight() {
        // bed 23:00, target 07:00 -> period 20:00 .. 06:00
        val bedMin = 23 * 60
        val targetMin = 7 * 60
        assertTrue(SleepOnsetDetector.inDetectionPeriod(20 * 60, bedMin, targetMin))
        assertTrue(SleepOnsetDetector.inDetectionPeriod(0, bedMin, targetMin))
        assertTrue(SleepOnsetDetector.inDetectionPeriod(359, bedMin, targetMin))
        assertFalse(SleepOnsetDetector.inDetectionPeriod(360, bedMin, targetMin))
        assertFalse(SleepOnsetDetector.inDetectionPeriod(19 * 60 + 59, bedMin, targetMin))
        assertFalse(SleepOnsetDetector.inDetectionPeriod(12 * 60, bedMin, targetMin))
    }

    @Test
    fun detectionPeriodWithoutWrap() {
        // bed 20:00, target 22:00 -> period 17:00 .. 21:00
        assertTrue(SleepOnsetDetector.inDetectionPeriod(17 * 60, 20 * 60, 22 * 60))
        assertTrue(SleepOnsetDetector.inDetectionPeriod(20 * 60 + 59, 20 * 60, 22 * 60))
        assertFalse(SleepOnsetDetector.inDetectionPeriod(21 * 60, 20 * 60, 22 * 60))
        assertFalse(SleepOnsetDetector.inDetectionPeriod(16 * 60 + 59, 20 * 60, 22 * 60))
    }
}
