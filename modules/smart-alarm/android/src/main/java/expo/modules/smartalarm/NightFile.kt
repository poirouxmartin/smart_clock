package expo.modules.smartalarm

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException

/**
 * One JSON file per night in filesDir/nights/<sessionId>.json.
 * Epochs are [tMs, activity, maxDelta, samples]. Writes go to a .tmp file and are renamed over the target.
 */
object NightFile {
    private const val TAG = "SmartAlarm"
    private const val DIR = "nights"
    const val EPOCH_MS = 60_000L
    private val ID_PATTERN = Regex("[A-Za-z0-9_-]+")

    /** samples: accelerometer events received during the epoch (-1 = unknown, older files). */
    data class Epoch(val tMs: Long, val activity: Double, val maxDelta: Double, val samples: Int = -1)

    private fun dir(ctx: Context): File = File(ctx.filesDir, DIR).apply { mkdirs() }

    private fun fileFor(ctx: Context, sessionId: String): File {
        require(ID_PATTERN.matches(sessionId)) { "invalid sessionId: $sessionId" }
        return File(dir(ctx), "$sessionId.json")
    }

    fun create(ctx: Context, sessionId: String, startedAtMs: Long, targetAtMs: Long, windowMinutes: Int) {
        val json = JSONObject()
            .put("sessionId", sessionId)
            .put("startedAtMs", startedAtMs)
            .put("targetAtMs", targetAtMs)
            .put("windowMinutes", windowMinutes)
            .put("epochMs", EPOCH_MS)
            .put("epochs", JSONArray())
            .put("endedAtMs", 0L)
            .put("wakeAtMs", 0L)
            .put("wakeReason", "")
        writeAtomic(fileFor(ctx, sessionId), json.toString())
    }

    /** Replaces the epochs array (full rewrite; the tracker keeps the list in memory). */
    fun rewrite(ctx: Context, sessionId: String, epochs: List<Epoch>): Boolean =
        update(ctx, sessionId) { it.put("epochs", epochsToJson(epochs)) }

    fun finalize(
        ctx: Context,
        sessionId: String,
        epochs: List<Epoch>,
        endedAtMs: Long,
        wakeAtMs: Long,
        wakeReason: String,
    ): Boolean = update(ctx, sessionId) {
        it.put("epochs", epochsToJson(epochs))
            .put("endedAtMs", endedAtMs)
            .put("wakeAtMs", wakeAtMs)
            .put("wakeReason", wakeReason)
    }

    fun read(ctx: Context, sessionId: String): String? {
        val file = fileFor(ctx, sessionId)
        return if (file.exists()) file.readText() else null
    }

    /** Session ids, newest first (sorted descending by name). */
    fun list(ctx: Context): List<String> =
        dir(ctx).listFiles { f -> f.name.endsWith(".json") }
            ?.map { it.name.removeSuffix(".json") }
            ?.sortedDescending()
            ?: emptyList()

    fun delete(ctx: Context, sessionId: String): Boolean = fileFor(ctx, sessionId).delete()

    fun loadEpochs(ctx: Context, sessionId: String): List<Epoch> {
        return try {
            val text = read(ctx, sessionId) ?: return emptyList()
            val arr = JSONObject(text).optJSONArray("epochs") ?: return emptyList()
            (0 until arr.length()).map { i ->
                val e = arr.getJSONArray(i)
                Epoch(e.getLong(0), e.getDouble(1), e.getDouble(2), e.optInt(3, -1))
            }
        } catch (e: Exception) {
            Log.w(TAG, "Unreadable night file $sessionId", e)
            emptyList()
        }
    }

    private fun epochsToJson(epochs: List<Epoch>): JSONArray {
        val arr = JSONArray()
        epochs.forEach { arr.put(JSONArray().put(it.tMs).put(it.activity).put(it.maxDelta).put(it.samples)) }
        return arr
    }

    private fun update(ctx: Context, sessionId: String, block: (JSONObject) -> Unit): Boolean {
        return try {
            val file = fileFor(ctx, sessionId)
            if (!file.exists()) return false
            val json = JSONObject(file.readText())
            block(json)
            writeAtomic(file, json.toString())
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update night file $sessionId", e)
            false
        }
    }

    private fun writeAtomic(target: File, text: String) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.writeText(text)
        if (!tmp.renameTo(target)) throw IOException("Cannot rename ${tmp.name} to ${target.name}")
    }
}
