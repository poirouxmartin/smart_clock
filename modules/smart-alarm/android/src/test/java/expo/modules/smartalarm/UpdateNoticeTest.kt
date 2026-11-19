package expo.modules.smartalarm

import expo.modules.smartalarm.UpdateNotice.Asset
import expo.modules.smartalarm.UpdateNotice.Decision
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateNoticeTest {
    private val prefix = AppUpdater.URL_PREFIX
    private fun apk(tag: String) = Asset("aube-$tag.apk", "$prefix$tag/aube-$tag.apk")
    private fun release(tag: String) = UpdateNotice.pick(tag, false, false, listOf(apk(tag)), prefix)

    /** What the background check decides, given the installed version and the latest release. */
    private fun decide(installed: String, latestTag: String?, lastNotified: String?, canPost: Boolean = true) =
        UpdateNotice.decide(UpdateNotice.newer(installed, latestTag?.let(::release)), lastNotified, canPost)

    @Test fun comparesVersionsNumerically() {
        assertEquals(1, UpdateNotice.compareVersions("1.4.10", "1.4.9"))
        assertEquals(-1, UpdateNotice.compareVersions("1.4.5", "1.5.0"))
        assertEquals(0, UpdateNotice.compareVersions("v1.4.5", "1.4.5"))
        assertEquals(0, UpdateNotice.compareVersions("1.4", "1.4.0"))
        assertEquals(0, UpdateNotice.compareVersions("1.4.5-debug", "1.4.5"))
        assertEquals(1, UpdateNotice.compareVersions("2.0.0", "1.99.99"))
    }

    @Test fun picksOnlyTrustedStableReleases() {
        assertEquals(UpdateNotice.Offer("1.4.6", apk("v1.4.6").url), release("v1.4.6"))
        assertNull(UpdateNotice.pick("v1.4.6", true, false, listOf(apk("v1.4.6")), prefix))
        assertNull(UpdateNotice.pick("v1.4.6", false, true, listOf(apk("v1.4.6")), prefix))
        assertNull(UpdateNotice.pick("v1.4.6-beta", false, false, listOf(apk("v1.4.6")), prefix))
        assertNull(UpdateNotice.pick(null, false, false, listOf(apk("v1.4.6")), prefix))
        assertNull(UpdateNotice.pick("v1.4.6", false, false, emptyList(), prefix))
        assertNull(UpdateNotice.pick("v1.4.6", false, false, listOf(Asset("aube.apk", "https://evil.example/aube.apk")), prefix))
        assertNull(UpdateNotice.pick("v1.4.6", false, false, listOf(Asset("notes.txt", "${prefix}v1.4.6/notes.txt")), prefix))
    }

    @Test fun newVersionIsNotified() {
        assertEquals(Decision.NOTIFY, decide("1.4.5", "v1.4.6", null))
        assertEquals(Decision.NOTIFY, decide("1.4.5", "v1.5.0", "1.4.6"))
    }

    @Test fun sameVersionIsNotifiedOnlyOnce() {
        assertEquals(Decision.ALREADY_NOTIFIED, decide("1.4.5", "v1.4.6", "1.4.6"))
        assertEquals(Decision.ALREADY_NOTIFIED, decide("1.4.5", "v1.4.6", "1.5.0"))
    }

    @Test fun withoutPermissionNothingIsPostedNorRemembered() {
        assertEquals(Decision.NO_PERMISSION, decide("1.4.5", "v1.4.6", null, canPost = false))
        assertEquals(Decision.ALREADY_NOTIFIED, decide("1.4.5", "v1.4.6", "1.4.6", canPost = false))
    }

    @Test fun nothingNewerMeansNoNotification() {
        assertEquals(Decision.NONE, decide("1.4.6", "v1.4.6", null))
        assertEquals(Decision.NONE, decide("1.5.0", "v1.4.6", null))
        assertEquals(Decision.NONE, decide("1.4.5", null, null))
    }

    @Test fun staleOnceInstalledCaughtUp() {
        assertTrue(UpdateNotice.isStale("1.4.6", "1.4.6"))
        assertTrue(UpdateNotice.isStale("1.4.6", "1.5.0"))
        assertFalse(UpdateNotice.isStale("1.4.6", "1.4.5"))
        assertFalse(UpdateNotice.isStale(null, "1.4.6"))
    }

    @Test fun scheduleIsPeriodicWithNetworkEvery6To12Hours() {
        val s = UpdateNotice.SCHEDULE
        val hour = 60L * 60 * 1000
        assertTrue(s.periodMs in 6 * hour..12 * hour)
        assertTrue(s.flexMs in 1..s.periodMs)
        assertTrue(s.requiresNetwork)
        assertTrue(s.persisted)
    }

    @Test fun reschedulesOnlyWhenMissingOrChanged() {
        assertTrue(UpdateNotice.needsSchedule(null))
        assertFalse(UpdateNotice.needsSchedule(UpdateNotice.SCHEDULE))
        assertTrue(UpdateNotice.needsSchedule(UpdateNotice.SCHEDULE.copy(periodMs = 24L * 60 * 60 * 1000)))
        assertTrue(UpdateNotice.needsSchedule(UpdateNotice.SCHEDULE.copy(requiresNetwork = false)))
    }
}
