package expo.modules.smartalarm

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpdaterTest {

    private val good = "https://github.com/poirouxmartin/smart_clock/releases/download/v1.4.1/aube-v1.4.1.apk"

    @Test
    fun acceptsOfficialReleaseApk() {
        assertTrue(AppUpdater.isAllowedUrl(good))
    }

    @Test
    fun rejectsOtherRepo() {
        assertFalse(AppUpdater.isAllowedUrl("https://github.com/someone/else/releases/download/v1.4.1/aube-v1.4.1.apk"))
    }

    @Test
    fun rejectsPlainHttp() {
        assertFalse(AppUpdater.isAllowedUrl(good.replace("https://", "http://")))
    }

    @Test
    fun rejectsNonApk() {
        assertFalse(AppUpdater.isAllowedUrl(good.removeSuffix(".apk") + ".zip"))
    }

    @Test
    fun rejectsPathTraversal() {
        assertFalse(AppUpdater.isAllowedUrl(AppUpdater.URL_PREFIX + "../../evil/aube.apk"))
    }

    @Test
    fun rejectsPrefixLookalike() {
        assertFalse(AppUpdater.isAllowedUrl("https://github.com/poirouxmartin/smart_clock_evil/releases/download/v1.4.1/aube-v1.4.1.apk"))
    }
}
