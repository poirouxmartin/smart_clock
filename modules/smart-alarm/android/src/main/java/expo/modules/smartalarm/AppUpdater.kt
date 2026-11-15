package expo.modules.smartalarm

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * In-app updater: downloads the release APK from the public GitHub repo and hands it to the
 * system installer. Trust anchors: the URL prefix, then the package name and version of the
 * downloaded file (Android itself refuses an APK signed with another key).
 * Adapted from the Certo updater.
 */
object AppUpdater {
    /**
     * The only place that says where releases live. Must be a PUBLIC repo: the app has no token.
     * smart_clock is private today, so this must point to a public repo (e.g.
     * poirouxmartin/aube-releases) or smart_clock must be made public; see docs/retours-1511.md.
     */
    const val RELEASES_REPO = "poirouxmartin/smart_clock"
    const val RELEASES_API_URL = "https://api.github.com/repos/$RELEASES_REPO/releases/latest"
    const val URL_PREFIX = "https://github.com/$RELEASES_REPO/releases/download/"
    private const val MAX_REDIRECTS = 5

    /** Result codes returned to JS (never thrown). */
    const val STARTED = "started"
    const val NEED_PERMISSION = "need_permission"
    const val BAD_URL = "bad_url"
    const val DOWNLOAD_FAILED = "download_failed"
    const val BAD_APK = "bad_apk"
    const val NOT_NEWER = "not_newer"

    fun isAllowedUrl(url: String): Boolean =
        url.startsWith(URL_PREFIX) && url.endsWith(".apk") && !url.contains("..")

    fun versionInfo(ctx: Context): Map<String, Any> {
        val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        return mapOf(
            "versionName" to (info.versionName ?: ""),
            "versionCode" to versionCodeOf(info).toDouble(),
            "releasesApiUrl" to RELEASES_API_URL,
            "apkUrlPrefix" to URL_PREFIX,
        )
    }

    /** Blocking: call from a worker thread. */
    fun downloadAndInstall(ctx: Context, url: String, expectedVersion: String): String {
        if (!isAllowedUrl(url)) return BAD_URL
        val dir = File(ctx.cacheDir, "updates").apply { mkdirs() }
        val apk = File(dir, "update.apk")
        try {
            val conn = open(url)
            try {
                conn.inputStream.use { input -> apk.outputStream().use { input.copyTo(it, 64 * 1024) } }
            } finally {
                conn.disconnect()
            }
        } catch (e: IOException) {
            apk.delete()
            android.util.Log.w("AubeUpdate", "download failed: ${e.message}")
            return DOWNLOAD_FAILED
        }

        val pm = ctx.packageManager
        val pkg = ctx.packageName
        val downloaded = pm.getPackageArchiveInfo(apk.absolutePath, 0)
        if (downloaded == null || downloaded.packageName != pkg || downloaded.versionName != expectedVersion) {
            apk.delete()
            return BAD_APK
        }
        if (versionCodeOf(downloaded) <= versionCodeOf(pm.getPackageInfo(pkg, 0))) {
            apk.delete()
            return NOT_NEWER
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !pm.canRequestPackageInstalls()) {
            // Per-app "install unknown apps" toggle; the user taps Install again once granted.
            val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$pkg"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(settings)
            return NEED_PERMISSION
        }

        val uri = FileProvider.getUriForFile(ctx, "$pkg.aubeupdates", apk)
        val install = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(install)
        return STARTED
    }

    /** GitHub answers with a 302 to another host; redirects are walked by hand, HTTPS only. */
    private fun open(start: String): HttpURLConnection {
        var next = start
        var hop = 0
        while (true) {
            val conn = URL(next).openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 20_000
            conn.readTimeout = 60_000
            val code = conn.responseCode
            if (code / 100 != 3) {
                if (code != HttpURLConnection.HTTP_OK) {
                    conn.disconnect()
                    throw IOException("HTTP $code")
                }
                return conn
            }
            val location = conn.getHeaderField("Location")
            conn.disconnect()
            if (location == null || hop == MAX_REDIRECTS) throw IOException("bad redirect")
            next = URL(URL(next), location).toString()
            if (!next.startsWith("https://")) throw IOException("non-HTTPS redirect")
            hop++
        }
    }

    @Suppress("DEPRECATION")
    private fun versionCodeOf(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
}

/** Own subclass so the authority cannot clash with another library's FileProvider. */
class UpdateFileProvider : FileProvider()
