package expo.modules.smartalarm

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Background update check. The in-app banner only shows while the app is open, so a release could
 * sit unseen. About every 6 h, with network, this job reads the latest GitHub release (same source
 * and filter as the banner, so it never announces a version the app would not offer) and posts
 * "Update available" once per new version. Tapping it opens the app on the Install / Later dialog.
 *
 * JobScheduler rather than WorkManager: a persisted periodic job survives reboots and needs no new
 * dependency.
 */
class UpdateCheckJob : JobService() {
    companion object {
        private const val TAG = "AubeUpdateNotice"
        private const val JOB_ID = 7301
        private const val NOTIF_ID = 7302
        private const val CHANNEL = "app_updates"
        private const val PREFS = "aube_update_notice"
        private const val KEY_NOTIFIED = "lastNotified"
        private const val KEY_OPEN = "openRequested"
        private const val TIMEOUT_MS = 15_000

        /** Schedules the periodic check; does nothing when it is already pending with the expected parameters. */
        @Suppress("DEPRECATION")
        fun schedule(ctx: Context) {
            try {
                val js = ctx.getSystemService(JobScheduler::class.java) ?: return
                val info = js.getPendingJob(JOB_ID)
                val pending = if (info != null && info.isPeriodic) {
                    // The platform may clamp the flex window, so flexMs is copied from SCHEDULE: only
                    // period, network and persistence are compared, otherwise we would reschedule forever.
                    UpdateNotice.Schedule(
                        periodMs = info.intervalMillis,
                        flexMs = UpdateNotice.SCHEDULE.flexMs,
                        requiresNetwork = info.networkType != JobInfo.NETWORK_TYPE_NONE,
                        persisted = info.isPersisted,
                    )
                } else {
                    null
                }
                if (!UpdateNotice.needsSchedule(pending)) return
                val s = UpdateNotice.SCHEDULE
                val builder = JobInfo.Builder(JOB_ID, ComponentName(ctx, UpdateCheckJob::class.java))
                    .setPersisted(s.persisted)
                    .setPeriodic(s.periodMs, s.flexMs)
                if (s.requiresNetwork) builder.setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                js.schedule(builder.build())
            } catch (e: RuntimeException) {
                Log.w(TAG, "could not schedule the update check", e)
            }
        }

        /** Removes the posted notification once the installed version caught up with it. */
        fun clearIfInstalled(ctx: Context) {
            val notified = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_NOTIFIED, null)
            if (UpdateNotice.isStale(notified, installedVersion(ctx))) {
                ctx.getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
            }
        }

        /** True once after the notification was tapped; the flag is reset. */
        fun consumeOpenRequest(ctx: Context): Boolean {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val requested = prefs.getBoolean(KEY_OPEN, false)
            if (requested) prefs.edit().putBoolean(KEY_OPEN, false).apply()
            return requested
        }

        /** One check: blocking network call, run it off the UI thread. */
        fun check(ctx: Context) {
            val installed = installedVersion(ctx)
            val conn = URL(AppUpdater.RELEASES_API_URL).openConnection() as HttpURLConnection
            val body = try {
                conn.requestMethod = "GET"
                conn.setRequestProperty("Accept", "application/vnd.github+json")
                conn.connectTimeout = TIMEOUT_MS
                conn.readTimeout = TIMEOUT_MS
                if (conn.responseCode != HttpURLConnection.HTTP_OK) {
                    Log.i(TAG, "release lookup answered HTTP ${conn.responseCode}")
                    return
                }
                conn.inputStream.bufferedReader().use { it.readText() }
            } finally {
                conn.disconnect()
            }
            val json = JSONObject(body)
            val assets = mutableListOf<UpdateNotice.Asset>()
            val arr = json.optJSONArray("assets")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val a = arr.optJSONObject(i) ?: continue
                    assets.add(UpdateNotice.Asset(a.optString("name"), a.optString("browser_download_url")))
                }
            }
            val tag = if (json.has("tag_name") && !json.isNull("tag_name")) json.optString("tag_name") else null
            val latest = UpdateNotice.pick(tag, json.optBoolean("draft"), json.optBoolean("prerelease"), assets, AppUpdater.URL_PREFIX)
            val offered = UpdateNotice.newer(installed, latest)

            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            ensureChannel(ctx)
            val decision = UpdateNotice.decide(offered, prefs.getString(KEY_NOTIFIED, null), canPost(ctx))
            when (decision) {
                UpdateNotice.Decision.NOTIFY -> if (offered != null && post(ctx, offered)) {
                    prefs.edit().putString(KEY_NOTIFIED, offered.version).apply()
                }
                // NO_PERMISSION is deliberately not remembered: the version is announced once notifications are allowed.
                UpdateNotice.Decision.NO_PERMISSION, UpdateNotice.Decision.NONE, UpdateNotice.Decision.ALREADY_NOTIFIED ->
                    Log.i(TAG, "no notification: $decision")
            }
            Log.i(TAG, "installed=$installed latest=${latest?.version} decision=$decision")
        }

        private fun installedVersion(ctx: Context): String =
            ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "0.0.0"

        private fun hasPermission(ctx: Context) = Build.VERSION.SDK_INT < 33 ||
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

        /** Never prompts from the background. */
        private fun canPost(ctx: Context): Boolean {
            if (!hasPermission(ctx)) return false
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
            if (!nm.areNotificationsEnabled()) return false
            return nm.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
        }

        private fun ensureChannel(ctx: Context) {
            val channel = NotificationChannel(CHANNEL, ctx.getString(R.string.channel_updates), NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = ctx.getString(R.string.channel_updates_desc)
            ctx.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }

        private fun post(ctx: Context, offer: UpdateNotice.Offer): Boolean {
            val open = Intent(ctx, UpdateOpenActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val tap = PendingIntent.getActivity(ctx, NOTIF_ID, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(ctx.getString(R.string.update_notif_title, offer.version))
                .setContentText(ctx.getString(R.string.update_notif_text))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
            return try {
                NotificationManagerCompat.from(ctx).notify(NOTIF_ID, notification)
                true
            } catch (e: SecurityException) {
                Log.w(TAG, "notification refused", e)
                false
            }
        }
    }

    override fun onStartJob(params: JobParameters): Boolean {
        val ctx = applicationContext
        Thread({
            try {
                check(ctx)
            } catch (e: Exception) {
                Log.w(TAG, "update check failed", e)
            } finally {
                jobFinished(params, false)
            }
        }, "aube-update-check").start()
        return true
    }

    override fun onStopJob(params: JobParameters) = false // the next period retries
}
