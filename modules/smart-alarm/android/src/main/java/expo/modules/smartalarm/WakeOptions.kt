package expo.modules.smartalarm

import android.content.Context

object WakeOptions {
    private const val PREFS = "smart_alarm_options"
    private const val K_SOUND = "sound"
    private const val K_RAMP = "rampSeconds"
    private const val K_DAWN = "dawnEnabled"
    private const val K_DAWN_MIN = "dawnMinutes"
    private const val K_TORCH = "torch"

    private const val DEFAULT_RAMP = 60
    private const val MIN_RAMP = 15
    private const val MAX_RAMP = 300
    private const val DEFAULT_DAWN_MIN = 30
    private const val MIN_DAWN_MIN = 5
    private const val MAX_DAWN_MIN = 60

    private fun prefs(ctx: Context) = Prefs.get(ctx, PREFS)

    /** Always a bundled nature sound: a stored legacy "system" value reads as the default. */
    fun sound(ctx: Context): String = NatureSound.normalize(prefs(ctx).getString(K_SOUND, null))

    fun rampSeconds(ctx: Context): Int =
        prefs(ctx).getInt(K_RAMP, DEFAULT_RAMP).coerceIn(MIN_RAMP, MAX_RAMP)

    fun dawnEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean(K_DAWN, true)

    fun dawnMinutes(ctx: Context): Int =
        prefs(ctx).getInt(K_DAWN_MIN, DEFAULT_DAWN_MIN).coerceIn(MIN_DAWN_MIN, MAX_DAWN_MIN)

    fun torch(ctx: Context): Boolean = prefs(ctx).getBoolean(K_TORCH, false)

    /** Null arguments leave the stored value unchanged. Unknown sounds are ignored. */
    fun save(
        ctx: Context,
        sound: String?,
        rampSeconds: Int?,
        dawnEnabled: Boolean?,
        dawnMinutes: Int?,
        torch: Boolean?,
    ) {
        prefs(ctx).edit().apply {
            if (sound != null && sound in NatureSound.IDS) putString(K_SOUND, sound)
            rampSeconds?.let { putInt(K_RAMP, it.coerceIn(MIN_RAMP, MAX_RAMP)) }
            dawnEnabled?.let { putBoolean(K_DAWN, it) }
            dawnMinutes?.let { putInt(K_DAWN_MIN, it.coerceIn(MIN_DAWN_MIN, MAX_DAWN_MIN)) }
            torch?.let { putBoolean(K_TORCH, it) }
            apply()
        }
    }

    fun toMap(ctx: Context): Map<String, Any?> = mapOf(
        "sound" to sound(ctx),
        "rampSeconds" to rampSeconds(ctx),
        "dawnEnabled" to dawnEnabled(ctx),
        "dawnMinutes" to dawnMinutes(ctx),
        "torch" to torch(ctx),
    )
}
