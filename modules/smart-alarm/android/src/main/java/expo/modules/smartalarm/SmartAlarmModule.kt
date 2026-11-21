package expo.modules.smartalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmartAlarmModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context lost")

    override fun definition() = ModuleDefinition {
        Name("SmartAlarm")

        AsyncFunction("startNight") { targetAtMs: Double, windowMinutes: Int ->
            startNight(targetAtMs.toLong(), windowMinutes)
        }
        AsyncFunction("cancelNight") { cancelNight() }
        AsyncFunction("getStatus") { getStatus() }
        AsyncFunction("getPermissions") { getPermissions() }
        AsyncFunction("openExactAlarmSettings") { openExactAlarmSettings() }
        AsyncFunction("openFullScreenIntentSettings") { openFullScreenIntentSettings() }
        AsyncFunction("requestIgnoreBatteryOptimizations") { requestIgnoreBatteryOptimizations() }
        AsyncFunction("listNights") { NightFile.list(context) }
        AsyncFunction("readNight") { sessionId: String -> NightFile.read(context, sessionId) }
        AsyncFunction("deleteNight") { sessionId: String -> NightFile.delete(context, sessionId) }
        AsyncFunction("testRing") { delaySeconds: Int -> testRing(delaySeconds) }
        AsyncFunction("markSummarySeen") { markSummarySeen() }
        AsyncFunction("getWakeOptions") { WakeOptions.toMap(context) }
        AsyncFunction("setWakeOptions") { options: Map<String, Any?> -> setWakeOptions(options) }
        AsyncFunction("previewSound") { id: String -> SoundPreview.play(context, id) }
        AsyncFunction("stopPreview") { SoundPreview.stop() }
        AsyncFunction("getWakeLog") { WakeLog.read(context) }
        AsyncFunction("getDiagnostics") { getDiagnostics() }
        AsyncFunction("getAppVersion") { WakeLog.appVersion(context) }
        AsyncFunction("getVersionInfo") { AppUpdater.versionInfo(context) }
        AsyncFunction("downloadAndInstallUpdate") { url: String, expectedVersion: String, promise: expo.modules.kotlin.Promise ->
            val ctx = context
            Thread {
                val r = try {
                    AppUpdater.downloadAndInstall(ctx, url, expectedVersion)
                } catch (e: Exception) {
                    android.util.Log.w("AubeUpdate", "install failed", e)
                    AppUpdater.DOWNLOAD_FAILED
                }
                promise.resolve(r)
            }.start()
        }
        AsyncFunction("getRingState") {
            mapOf(
                "ringing" to RingService.isRinging,
                "reason" to RingService.currentReason,
                "snoozeUntilMs" to AlarmStore.snoozeUntilMs(context).toDouble(),
            )
        }
        AsyncFunction("stopRing") { sendRingAction(AlarmScheduler.ACTION_STOP) }
        AsyncFunction("snoozeRing") { sendRingAction(AlarmScheduler.ACTION_SNOOZE) }
        AsyncFunction("configureAuto") { cfg: Map<String, Any?> -> configureAuto(cfg) }
        AsyncFunction("getAutoStatus") { AutoStore.toMap(context) }
        AsyncFunction("skipNextAuto") {
            UpcomingAlarm.skipNext(context)
            AutoStore.toMap(context)
        }
        AsyncFunction("unskipAuto") {
            UpcomingAlarm.unskip(context)
            AutoStore.toMap(context)
        }
        AsyncFunction("setUpcomingNotification") { enabled: Boolean ->
            AutoStore.save(context, upcomingNotif = enabled)
            UpcomingAlarm.refresh(context)
            AutoStore.toMap(context)
        }
    }

    private fun sendRingAction(action: String) {
        val ctx = context
        try {
            ctx.startService(Intent(ctx, RingService::class.java).setAction(action))
        } catch (e: Exception) {
            android.util.Log.w("SmartAlarm", "Cannot send $action to RingService", e)
        }
    }

    private fun startNight(targetAtMs: Long, windowMinutes: Int): Map<String, Any?> {
        val ctx = context
        val now = System.currentTimeMillis()
        require(targetAtMs > now) { "targetAtMs must be in the future" }
        require(windowMinutes in 0..120) { "windowMinutes must be in 0..120" }
        val exact = NightSession.start(ctx, targetAtMs, windowMinutes)
        return mapOf("exactAlarm" to exact)
    }

    private fun cancelNight() {
        NightSession.cancel(context)
    }

    private fun configureAuto(cfg: Map<String, Any?>): Map<String, Any?> {
        val ctx = context
        AutoManager.configure(
            ctx,
            cfg["enabled"] as? Boolean ?: false,
            (cfg["hour"] as? Number)?.toInt() ?: AutoStore.hour(ctx),
            (cfg["minute"] as? Number)?.toInt() ?: AutoStore.minute(ctx),
            (cfg["daysMask"] as? Number)?.toInt() ?: AutoStore.daysMask(ctx),
            (cfg["windowMinutes"] as? Number)?.toInt() ?: AutoStore.windowMinutes(ctx),
        )
        return AutoStore.toMap(ctx)
    }

    private fun getStatus(): Map<String, Any?> {
        val ctx = context
        // Opening the app heals a ghost night, so Home never hides "Commencer la nuit maintenant" for nothing.
        NightSession.repair(ctx)
        return mapOf(
            "state" to AlarmStore.state(ctx),
            "sessionId" to AlarmStore.sessionId(ctx),
            "startedAtMs" to AlarmStore.startedAtMs(ctx),
            "targetAtMs" to AlarmStore.targetAtMs(ctx),
            "windowMinutes" to AlarmStore.windowMinutes(ctx),
            "firedAtMs" to AlarmStore.firedAtMs(ctx),
            "firedReason" to AlarmStore.firedReason(ctx),
            "epochCount" to SleepTrackingService.epochCount,
            "trackingAlive" to SleepTrackingService.running,
            "lastActivity" to SleepTrackingService.lastActivity,
            "lastSamples" to SleepTrackingService.lastSamples,
            "summarySeen" to AlarmStore.summarySeen(ctx),
        )
    }

    private fun getPermissions(): Map<String, Any?> {
        val ctx = context
        val am = ctx.getSystemService(AlarmManager::class.java)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val pm = ctx.getSystemService(PowerManager::class.java)
        return mapOf(
            "exactAlarm" to (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()),
            "fullScreenIntent" to (Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent()),
            "notifications" to NotificationManagerCompat.from(ctx).areNotificationsEnabled(),
            "ignoringBatteryOptimizations" to pm.isIgnoringBatteryOptimizations(ctx.packageName),
        )
    }

    private fun getDiagnostics(): String {
        val ctx = context
        val perms = getPermissions()
        val restricted = if (Build.VERSION.SDK_INT >= 28) {
            ctx.getSystemService(android.app.ActivityManager::class.java).isBackgroundRestricted
        } else {
            "n/a"
        }
        val bucket = if (Build.VERSION.SDK_INT >= 28) {
            ctx.getSystemService(android.app.usage.UsageStatsManager::class.java).appStandbyBucket
        } else {
            "n/a"
        }
        return buildString {
            appendLine("App ${WakeLog.appVersion(ctx)}")
            appendLine("Device ${Build.MANUFACTURER} ${Build.MODEL} sdk=${Build.VERSION.SDK_INT}")
            appendLine("ignoringBatteryOptimizations=${perms["ignoringBatteryOptimizations"]}")
            appendLine("exactAlarm=${perms["exactAlarm"]}")
            appendLine("backgroundRestricted=$restricted")
            appendLine("standbyBucket=$bucket")
            appendLine("state=${AlarmStore.state(ctx)} target=${NightLog.stamp(AlarmStore.targetAtMs(ctx))}")
            appendLine()
            appendLine("== Process exits ==")
            appendLine(NightLog.exitReasons(ctx))
            appendLine()
            appendLine("== Night log ==")
            appendLine(NightLog.read(ctx))
            appendLine("== Wake log ==")
            appendLine(WakeLog.read(ctx))
        }
    }

    private fun openExactAlarmSettings() {
        val ctx = context
        val intent = if (Build.VERSION.SDK_INT >= 31) {
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${ctx.packageName}"))
        } else {
            appDetailsIntent(ctx)
        }
        startSettings(ctx, intent)
    }

    private fun openFullScreenIntentSettings() {
        val ctx = context
        val intent = if (Build.VERSION.SDK_INT >= 34) {
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${ctx.packageName}"))
        } else {
            appDetailsIntent(ctx)
        }
        startSettings(ctx, intent)
    }

    private fun requestIgnoreBatteryOptimizations() {
        val ctx = context
        val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${ctx.packageName}"),
        )
        startSettings(ctx, intent)
    }

    private fun appDetailsIntent(ctx: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))

    private fun startSettings(ctx: Context, intent: Intent) {
        try {
            ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            ctx.startActivity(appDetailsIntent(ctx).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    private fun testRing(delaySeconds: Int) {
        val ctx = context
        AlarmScheduler.scheduleTest(ctx, System.currentTimeMillis() + delaySeconds * 1000L)
    }

    private fun markSummarySeen() {
        AlarmStore.edit(context) { putBoolean("summarySeen", true) }
    }

    private fun setWakeOptions(options: Map<String, Any?>): Map<String, Any?> {
        val ctx = context
        WakeOptions.save(
            ctx,
            sound = options["sound"] as? String,
            rampSeconds = (options["rampSeconds"] as? Number)?.toInt(),
            dawnEnabled = options["dawnEnabled"] as? Boolean,
            dawnMinutes = (options["dawnMinutes"] as? Number)?.toInt(),
            torch = options["torch"] as? Boolean,
        )
        return WakeOptions.toMap(ctx)
    }
}
