package expo.modules.smartalarm

object NatureSound {
    val IDS = listOf("system", "birds", "waves", "forest", "rain", "stream")

    fun rawName(id: String): String? = if (id == "system" || id !in IDS) null else "nature_$id"
}
