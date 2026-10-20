package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Test

class DawnCurveTest {

    @Test
    fun progressClampsAndHandlesEmptyWindow() {
        assertEquals(0.0, DawnCurve.progress(0L, 100L, 200L), 1e-9)
        assertEquals(0.5, DawnCurve.progress(150L, 100L, 200L), 1e-9)
        assertEquals(1.0, DawnCurve.progress(999L, 100L, 200L), 1e-9)
        assertEquals(1.0, DawnCurve.progress(50L, 100L, 100L), 1e-9)
    }

    @Test
    fun brightnessRampsQuadratically() {
        assertEquals(DawnCurve.MIN_BRIGHTNESS, DawnCurve.brightness(0.0), 1e-6f)
        assertEquals(1f, DawnCurve.brightness(1.0), 1e-6f)
        assertEquals(0.01f + 0.99f * 0.25f, DawnCurve.brightness(0.5), 1e-6f)
    }

    @Test
    fun colourEndpointsAndKeyframesMatch() {
        assertEquals(0xFF1A0500.toInt(), DawnCurve.color(0.0))
        assertEquals(0xFFFFE6B0.toInt(), DawnCurve.color(1.0))
        assertEquals(0xFFB83A00.toInt(), DawnCurve.color(0.55))
        assertEquals(0xFF, DawnCurve.color(0.4) ushr 24)
    }

    @Test
    fun torchLevelStepsAboveEightyPercent() {
        assertEquals(0, DawnCurve.torchLevel(0.79, 5))
        assertEquals(0, DawnCurve.torchLevel(1.0, 0))
        assertEquals(1, DawnCurve.torchLevel(0.8, 5))
        assertEquals(1, DawnCurve.torchLevel(0.82, 5))
        assertEquals(2, DawnCurve.torchLevel(0.875, 4))
        assertEquals(4, DawnCurve.torchLevel(0.99, 4))
        assertEquals(5, DawnCurve.torchLevel(1.0, 5))
    }
}
