package expo.modules.smartalarm

/**
 * Bundled CC0 nature ambiences (res/raw/nature_<id>.ogg). The alarm never falls back to the
 * system ringtone: an unknown or legacy id ("system" from 1.3.0) maps to the default sound.
 */
object NatureSound {
    const val DEFAULT = "birds"
    val IDS = listOf("birds", "waves", "forest", "rain", "stream", "storm")

    /** Known id, or DEFAULT for anything else (including the removed "system" choice). */
    fun normalize(id: String?): String = if (id != null && id in IDS) id else DEFAULT

    fun rawName(id: String?): String = "nature_${normalize(id)}"

    /** Ids to try in order: the chosen sound first, then every other bundled sound. */
    fun fallbackChain(id: String?): List<String> {
        val first = normalize(id)
        return listOf(first) + IDS.filter { it != first }
    }
}
