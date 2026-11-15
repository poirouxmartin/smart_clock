package expo.modules.smartalarm

import android.content.Context
import android.net.Uri

/**
 * Maps a nature sound id to its bundled raw resource. Uses direct R.raw references so the
 * resource shrinker never strips the files (name lookups via getIdentifier would let it).
 */
object SoundSource {
    fun resId(id: String): Int = when (NatureSound.normalize(id)) {
        "waves" -> R.raw.nature_waves
        "forest" -> R.raw.nature_forest
        "rain" -> R.raw.nature_rain
        "stream" -> R.raw.nature_stream
        "storm" -> R.raw.nature_storm
        else -> R.raw.nature_birds
    }

    fun uri(ctx: Context, id: String): Uri =
        Uri.parse("android.resource://${ctx.packageName}/${resId(id)}")
}
