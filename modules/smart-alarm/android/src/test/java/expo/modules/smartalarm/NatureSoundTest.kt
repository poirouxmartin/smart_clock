package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class NatureSoundTest {

    @Test
    fun natureIdsMapToRawNames() {
        assertEquals("nature_birds", NatureSound.rawName("birds"))
        assertEquals("nature_waves", NatureSound.rawName("waves"))
        assertEquals("nature_forest", NatureSound.rawName("forest"))
        assertEquals("nature_rain", NatureSound.rawName("rain"))
        assertEquals("nature_stream", NatureSound.rawName("stream"))
        assertEquals("nature_storm", NatureSound.rawName("storm"))
    }

    @Test
    fun systemAndUnknownIdsNeverMeanTheSystemRingtone() {
        // 1.3.0 offered "system": a stored legacy value must now play a nature sound.
        assertEquals("nature_birds", NatureSound.rawName("system"))
        assertEquals("nature_birds", NatureSound.rawName("nope"))
        assertEquals("nature_birds", NatureSound.rawName(null))
        assertFalse("system" in NatureSound.IDS)
    }

    @Test
    fun fallbackChainStartsWithChoiceAndCoversEverySound() {
        val chain = NatureSound.fallbackChain("rain")
        assertEquals("rain", chain.first())
        assertEquals(NatureSound.IDS.toSet(), chain.toSet())
        assertEquals(NatureSound.IDS.size, chain.size)
        assertEquals("birds", NatureSound.fallbackChain("system").first())
    }
}
