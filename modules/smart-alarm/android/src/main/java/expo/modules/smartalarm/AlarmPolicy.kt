package expo.modules.smartalarm

/** Pure alarm state transitions, no Android dependencies, so every rule is unit-tested. */
object AlarmPolicy {
    /** A ring auto-stops after 20 min: a RINGING state older than this with no live ring is a leftover. */
    const val STALE_RING_MS = 30 * 60_000L

    /** A ring this long before the automatic target already woke the sleeper for that target. */
    const val CONSUME_LEAD_MS = 3 * 60 * 60_000L

    /**
     * True when a persisted RINGING state no longer matches a live ring (process killed, battery
     * died, crash) and must be closed as DONE, else every later alarm is ignored (B1).
     * A pending snooze keeps the state. After a reboot no ring can be alive, so no grace delay.
     */
    fun isStaleRinging(
        state: String,
        firedAtMs: Long,
        snoozeUntilMs: Long,
        nowMs: Long,
        serviceRinging: Boolean,
        afterBoot: Boolean = false,
    ): Boolean {
        if (state != AlarmStore.RINGING || serviceRinging) return false
        if (snoozeUntilMs > nowMs) return false
        if (afterBoot) return true
        return nowMs - maxOf(firedAtMs, snoozeUntilMs) >= STALE_RING_MS
    }

    /** What rearm must do with the automatic alarm. */
    sealed class RearmPlan {
        /** No enabled day: cancel fallback, dawn and probes, show nothing (B4). */
        object Disarm : RearmPlan()

        /** Arm [targetMs]; probes are cleared only when the target changes (B5). */
        data class Arm(val targetMs: Long, val clearProbes: Boolean) : RearmPlan()
    }

    /**
     * Next automatic target. After a ring that already served the current target (smart wake
     * before it), the search starts from that target so it never rings a second time (B2).
     */
    fun planRearm(
        nowMs: Long,
        hour: Int,
        minute: Int,
        daysMask: Int,
        skippedMs: Long,
        state: String,
        firedAtMs: Long,
        currentTargetMs: Long,
        tz: java.util.TimeZone = java.util.TimeZone.getDefault(),
    ): RearmPlan {
        val from = searchFromMs(nowMs, state, firedAtMs, currentTargetMs)
        val target = AutoSchedule.nextTargetSkipping(from, hour, minute, daysMask, skippedMs, tz)
            ?: return RearmPlan.Disarm
        return RearmPlan.Arm(target, clearProbes = target != currentTargetMs)
    }

    /** A night found this long after its target with no ring is over. */
    const val MAX_LATE_MS = 30 * 60_000L

    enum class TrackingRepair { NONE, RESTART_SERVICE, RING_LATE, CLOSE }

    /**
     * Repairs a ghost night: state TRACKING with no live tracking service (service refused in the
     * background, killed, or stopped from its notification). Left alone, it hides "Commencer la
     * nuit maintenant", blocks automatic nights and records nothing (night of 17-18/11/2026).
     */
    fun trackingRepair(
        state: String,
        targetAtMs: Long,
        nowMs: Long,
        serviceAlive: Boolean,
        afterBoot: Boolean = false,
    ): TrackingRepair {
        if (state != AlarmStore.TRACKING) return TrackingRepair.NONE
        if (targetAtMs > nowMs) return if (serviceAlive) TrackingRepair.NONE else TrackingRepair.RESTART_SERVICE
        if (nowMs - targetAtMs >= MAX_LATE_MS) return TrackingRepair.CLOSE
        // Within the grace period the fallback alarm rings, except after a reboot that dropped it.
        return if (afterBoot) TrackingRepair.RING_LATE else TrackingRepair.NONE
    }

    /** Delay between two checks of a running night. */
    const val NIGHT_CHECK_MS = 15 * 60_000L

    /**
     * Next check of a TRACKING night, manual or automatic, up to its target. Each check restarts a
     * tracking service that Android killed without restarting it (night of 20-21/11/2026).
     */
    @Suppress("UNUSED_PARAMETER")
    fun trackingCheckAt(isAuto: Boolean, nowMs: Long, windowStartMs: Long, targetAtMs: Long): Long? {
        if (nowMs >= targetAtMs) return null
        return minOf(nowMs + NIGHT_CHECK_MS, targetAtMs)
    }

    internal fun searchFromMs(nowMs: Long, state: String, firedAtMs: Long, currentTargetMs: Long): Long {
        val consumed = state == AlarmStore.DONE &&
            firedAtMs > 0L &&
            currentTargetMs > nowMs &&
            currentTargetMs - firedAtMs in 0..CONSUME_LEAD_MS
        return if (consumed) currentTargetMs else nowMs
    }
}
