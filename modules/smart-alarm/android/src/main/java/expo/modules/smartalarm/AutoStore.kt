package expo.modules.smartalarm

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/** Settings and rolling history for automatic sleep detection, SharedPreferences "smart_alarm_auto". */
object AutoStore {
    private const val PREFS = "smart_alarm_auto"
    private const val MAX_PROBES = 12
    private const val MAX_ONSETS = 14
    private const val API_FRESH_MS = 20 * 60_000L
    private const val ALL_DAYS = 0x7F

    private fun prefs(ctx: Context): SharedPreferences = Prefs.get(ctx, PREFS)

    fun enabled(ctx: Context): Boolean = prefs(ctx).getBoolean("enabled", false)

    fun hour(ctx: Context): Int = prefs(ctx).getInt("hour", 7)

    fun minute(ctx: Context): Int = prefs(ctx).getInt("minute", 30)

    fun daysMask(ctx: Context): Int = prefs(ctx).getInt("daysMask", ALL_DAYS)

    fun windowMinutes(ctx: Context): Int = prefs(ctx).getInt("windowMinutes", 30)

    fun currentTargetMs(ctx: Context): Long = prefs(ctx).getLong("currentTargetMs", 0L)

    fun awakeNotifiedTargetMs(ctx: Context): Long = prefs(ctx).getLong("awakeNotifiedTargetMs", 0L)

    fun skippedTargetMs(ctx: Context): Long = prefs(ctx).getLong("skippedTargetMs", 0L)

    fun upcomingNotifEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean("upcomingNotif", true)

    fun apiConfidence(ctx: Context): Int = prefs(ctx).getInt("apiConfidence", -1)

    fun apiAtMs(ctx: Context): Long = prefs(ctx).getLong("apiAtMs", 0L)

    /** Writes only the non-null arguments. */
    fun save(
        ctx: Context,
        enabled: Boolean? = null,
        hour: Int? = null,
        minute: Int? = null,
        daysMask: Int? = null,
        windowMinutes: Int? = null,
        currentTargetMs: Long? = null,
        awakeNotifiedTargetMs: Long? = null,
        skippedTargetMs: Long? = null,
        upcomingNotif: Boolean? = null,
    ) {
        val e = prefs(ctx).edit()
        enabled?.let { e.putBoolean("enabled", it) }
        hour?.let { e.putInt("hour", it) }
        minute?.let { e.putInt("minute", it) }
        daysMask?.let { e.putInt("daysMask", it) }
        windowMinutes?.let { e.putInt("windowMinutes", it) }
        currentTargetMs?.let { e.putLong("currentTargetMs", it) }
        awakeNotifiedTargetMs?.let { e.putLong("awakeNotifiedTargetMs", it) }
        skippedTargetMs?.let { e.putLong("skippedTargetMs", it) }
        upcomingNotif?.let { e.putBoolean("upcomingNotif", it) }
        e.apply()
    }

    fun saveApiConfidence(ctx: Context, confidence: Int, atMs: Long) {
        prefs(ctx).edit()
            .putInt("apiConfidence", confidence)
            .putLong("apiAtMs", atMs)
            .apply()
    }

    /** Sleep API confidence if it was received less than 20 minutes ago, else null. */
    fun freshApiConfidence(ctx: Context, now: Long): Int? {
        val confidence = apiConfidence(ctx)
        return if (confidence >= 0 && now - apiAtMs(ctx) < API_FRESH_MS) confidence else null
    }

    /** Last [MAX_PROBES] probes, oldest first. */
    fun probes(ctx: Context): List<SleepProbe> {
        val text = prefs(ctx).getString("probes", null) ?: return emptyList()
        return try {
            val arr = JSONArray(text)
            (0 until arr.length()).map { fromJson(arr.getJSONObject(it)) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun addProbe(ctx: Context, probe: SleepProbe) {
        val arr = JSONArray()
        (probes(ctx) + probe).takeLast(MAX_PROBES).forEach { arr.put(toJson(it)) }
        prefs(ctx).edit().putString("probes", arr.toString()).apply()
    }

    fun clearProbes(ctx: Context) {
        prefs(ctx).edit().remove("probes").apply()
    }

    /** Last [MAX_ONSETS] detected onset minutes-of-day, oldest first. */
    fun onsetMinutes(ctx: Context): List<Int> {
        val text = prefs(ctx).getString("onsetMinutes", null) ?: return emptyList()
        return try {
            val arr = JSONArray(text)
            (0 until arr.length()).map { arr.getInt(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun addOnsetMinute(ctx: Context, minuteOfDay: Int) {
        val arr = JSONArray()
        (onsetMinutes(ctx) + minuteOfDay).takeLast(MAX_ONSETS).forEach { arr.put(it) }
        prefs(ctx).edit().putString("onsetMinutes", arr.toString()).apply()
    }

    fun usualBedMinute(ctx: Context): Int = UsualBedtime.estimate(onsetMinutes(ctx))

    fun toMap(ctx: Context): Map<String, Any?> {
        val usual = usualBedMinute(ctx)
        val now = System.currentTimeMillis()
        val last = probes(ctx).lastOrNull()
        return mapOf(
            "enabled" to enabled(ctx),
            "hour" to hour(ctx),
            "minute" to minute(ctx),
            "daysMask" to daysMask(ctx),
            "windowMinutes" to windowMinutes(ctx),
            "currentTargetMs" to currentTargetMs(ctx),
            "skippedTargetMs" to skippedTargetMs(ctx),
            "upcomingNotif" to upcomingNotifEnabled(ctx),
            "usualBedMinute" to usual,
            "lastProbeAtMs" to last?.tMs,
            "lastProbeScore" to last?.let { SleepOnsetDetector.score(it, AutoSchedule.minuteOfDay(it.tMs), usual) },
            "apiConfidence" to (freshApiConfidence(ctx, now) ?: -1),
        )
    }

    private fun toJson(p: SleepProbe): JSONObject {
        val o = JSONObject()
            .put("t", p.tMs)
            .put("screenOn", p.screenOn)
            .put("charging", p.charging)
        p.motion?.let { o.put("motion", it) }
        p.lux?.let { o.put("lux", it.toDouble()) }
        p.apiConfidence?.let { o.put("apiConfidence", it) }
        return o
    }

    private fun fromJson(o: JSONObject): SleepProbe = SleepProbe(
        tMs = o.getLong("t"),
        screenOn = o.getBoolean("screenOn"),
        charging = o.getBoolean("charging"),
        motion = if (o.has("motion")) o.getDouble("motion") else null,
        lux = if (o.has("lux")) o.getDouble("lux").toFloat() else null,
        apiConfidence = if (o.has("apiConfidence")) o.getInt("apiConfidence") else null,
    )
}
