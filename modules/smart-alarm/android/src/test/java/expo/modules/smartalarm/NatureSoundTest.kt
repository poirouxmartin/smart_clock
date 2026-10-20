package expo.modules.smartalarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NatureSoundTest {

    @Test
    fun natureIdsMapToRawNames() {
        assertEquals("nature_birds", NatureSound.rawName("birds"))
        assertEquals("nature_waves", NatureSound.rawName("waves"))
        assertEquals("nature_forest", NatureSound.rawName("forest"))
        assertEquals("nature_rain", NatureSound.rawName("rain"))
        assertEquals("nature_stream", NatureSound.rawName("stream"))
    }

    @Test
    fun systemHasNoRawName() {
        assertNull(NatureSound.rawName("system"))
    }

    @Test
    fun unknownIdHasNoRawName() {
        assertNull(NatureSound.rawName("unknown"))
        assertNull(NatureSound.rawName(""))
    }
}
