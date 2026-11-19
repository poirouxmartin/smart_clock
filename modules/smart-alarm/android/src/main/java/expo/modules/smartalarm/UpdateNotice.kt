package expo.modules.smartalarm

/**
 * Pure logic of the background update notification (no Android types, unit tested).
 * Mirrors src/modules/update/appUpdate.ts (compareVersions, pickUpdate) so the notification never
 * announces a release the in-app banner would not offer.
 */
object UpdateNotice {
    /** Every 6 h (within a 1 h flex window), only with network, kept across reboots. */
    val SCHEDULE = Schedule(periodMs = 6L * 60 * 60 * 1000, flexMs = 60L * 60 * 1000, requiresNetwork = true, persisted = true)

    data class Schedule(val periodMs: Long, val flexMs: Long, val requiresNetwork: Boolean, val persisted: Boolean)

    data class Asset(val name: String, val url: String)

    data class Offer(val version: String, val url: String)

    /** What the background check does with the latest release. */
    enum class Decision {
        /** Post the notification and remember its version. */
        NOTIFY,
        /** Nothing installable and newer than the installed version. */
        NONE,
        /** This version (or a newer one) was already announced. */
        ALREADY_NOTIFIED,
        /** Notifications are off: skip silently and do not remember the version. */
        NO_PERMISSION,
    }

    /** True when the job must be (re)scheduled: none pending, or pending with other parameters. */
    fun needsSchedule(pending: Schedule?): Boolean = pending != SCHEDULE

    /** Numeric per-segment comparison; leading 'v' and any '-suffix' are ignored, missing segments are 0. */
    fun compareVersions(a: String, b: String): Int {
        fun parse(v: String) = v.trim().removePrefix("v").removePrefix("V").substringBefore('-')
            .split('.').map { it.toIntOrNull() ?: 0 }
        val pa = parse(a)
        val pb = parse(b)
        for (i in 0 until maxOf(pa.size, pb.size)) {
            val x = pa.getOrElse(i) { 0 }
            val y = pb.getOrElse(i) { 0 }
            if (x != y) return if (x > y) 1 else -1
        }
        return 0
    }

    /** The installable update of a GitHub release, or null when it is not trustworthy (same rules as pickUpdate in JS). */
    fun pick(tag: String?, draft: Boolean, prerelease: Boolean, assets: List<Asset>, urlPrefix: String): Offer? {
        if (draft || prerelease || tag == null) return null
        val version = tag.removePrefix("v")
        if (!Regex("^\\d+\\.\\d+\\.\\d+$").matches(version)) return null
        val apk = assets.firstOrNull { it.name.endsWith(".apk") && it.url.startsWith(urlPrefix) } ?: return null
        return Offer(version, apk.url)
    }

    /** [latest] when it is newer than [installed], else null. */
    fun newer(installed: String, latest: Offer?): Offer? =
        latest?.takeIf { compareVersions(it.version, installed) > 0 }

    /** One notification per version: [lastNotified] is the version last announced, [canPost] whether one can be shown. */
    fun decide(offered: Offer?, lastNotified: String?, canPost: Boolean): Decision {
        if (offered == null) return Decision.NONE
        if (!lastNotified.isNullOrBlank() && compareVersions(offered.version, lastNotified) <= 0) return Decision.ALREADY_NOTIFIED
        return if (canPost) Decision.NOTIFY else Decision.NO_PERMISSION
    }

    /** True once the [installed] version caught up with the [notified] one: its notification is stale. */
    fun isStale(notified: String?, installed: String): Boolean =
        !notified.isNullOrBlank() && compareVersions(installed, notified) >= 0
}
