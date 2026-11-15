package expo.modules.smartalarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log

object SoundPreview {
    private const val TAG = "SmartAlarm"
    private const val VOLUME = 0.6f
    private const val AUTO_STOP_MS = 8_000L

    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private val autoStop = Runnable { stop() }

    /** Plays one preview at a time, on the media stream (not the alarm stream), for 8 s. */
    fun play(ctx: Context, id: String) {
        stop()
        val uri = uriFor(ctx, id)
        val mp = MediaPlayer()
        try {
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            mp.setDataSource(ctx, uri)
            mp.isLooping = true
            mp.setVolume(VOLUME, VOLUME)
            mp.prepare()
            mp.start()
            player = mp
            handler.postDelayed(autoStop, AUTO_STOP_MS)
        } catch (e: Exception) {
            Log.w(TAG, "Sound preview failed for $id", e)
            mp.release()
        }
    }

    fun stop() {
        handler.removeCallbacks(autoStop)
        player?.let {
            try {
                it.stop()
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Preview stop failed", e)
            }
            it.release()
        }
        player = null
    }

    private fun uriFor(ctx: Context, id: String): Uri = SoundSource.uri(ctx, id)
}
