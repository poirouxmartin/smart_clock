package expo.modules.smartalarm

enum class WidgetMode { IDLE, TRACKING, RINGING }

data class WidgetModel(val mode: WidgetMode, val fromMs: Long, val toMs: Long)

/** What the home-screen widget shows, derived from the night state. Pure, no Android types. */
object NightWidgetModel {
    fun of(
        state: String,
        targetAtMs: Long,
        windowStartMs: Long,
        nextTargetMs: Long?,
        nowMs: Long,
    ): WidgetModel = when {
        state == AlarmStore.RINGING -> WidgetModel(WidgetMode.RINGING, 0L, 0L)
        state == AlarmStore.TRACKING && targetAtMs > nowMs ->
            WidgetModel(WidgetMode.TRACKING, windowStartMs, targetAtMs)
        else -> WidgetModel(WidgetMode.IDLE, 0L, nextTargetMs ?: 0L)
    }
}
