package expo.modules.smartalarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle

/**
 * Trampoline behind the "Update available" notification. It records the tap, then brings the app to
 * the front. The JS UpdateBanner reads the flag on start and on return to the foreground (via
 * UpdateCheckJob.consumeOpenRequest) and shows the Install / Later dialog. This works for cold and
 * warm starts without any change to the Expo MainActivity.
 */
class UpdateOpenActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        getSharedPreferences("aube_update_notice", Context.MODE_PRIVATE)
            .edit().putBoolean("openRequested", true).commit()
        packageManager.getLaunchIntentForPackage(packageName)?.let {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            startActivity(it)
        }
        finish()
    }
}
