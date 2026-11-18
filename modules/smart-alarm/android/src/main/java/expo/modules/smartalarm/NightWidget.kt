package expo.modules.smartalarm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import java.util.Date

/** Home-screen widget: start the night in one tap, show its state, stop it. */
class NightWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        NightWidget.refresh(context)
    }
}

class NightWidgetActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val state = AlarmStore.state(context)
            when (intent.action) {
                NightWidget.ACTION_START -> if (state != AlarmStore.RINGING &&
                    !(state == AlarmStore.TRACKING && AlarmStore.targetAtMs(context) > System.currentTimeMillis())) {
                    val target = AutoSchedule.nextTargetMs(
                        System.currentTimeMillis(),
                        AutoStore.hour(context),
                        AutoStore.minute(context),
                        0x7F,
                    ) ?: return
                    NightSession.start(context, target, AutoStore.windowMinutes(context))
                    Toast.makeText(
                        context,
                        context.getString(R.string.widget_started, NightWidget.time(context, target)),
                        Toast.LENGTH_SHORT,
                    ).show()
                }
                NightWidget.ACTION_STOP -> if (state == AlarmStore.TRACKING) {
                    NightSession.cancel(context)
                    Toast.makeText(context, R.string.widget_stopped, Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            Log.w("SmartAlarm", "Widget action failed", e)
        } finally {
            NightWidget.refresh(context)
        }
    }
}

object NightWidget {
    const val ACTION_START = "expo.modules.smartalarm.WIDGET_START"
    const val ACTION_STOP = "expo.modules.smartalarm.WIDGET_STOP"
    private const val RC_OPEN = 2301
    private const val RC_START = 2302
    private const val RC_STOP = 2303

    fun time(ctx: Context, ms: Long): String = DateFormat.getTimeFormat(ctx).format(Date(ms))

    fun refresh(ctx: Context) {
        try {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, NightWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val now = System.currentTimeMillis()
            val next = AutoSchedule.nextTargetMs(now, AutoStore.hour(ctx), AutoStore.minute(ctx), 0x7F)
            val model = NightWidgetModel.of(
                AlarmStore.state(ctx),
                AlarmStore.targetAtMs(ctx),
                AlarmStore.windowStartMs(ctx),
                next,
                now,
            )
            val views = build(ctx, model)
            for (id in ids) mgr.updateAppWidget(id, views)
        } catch (e: Exception) {
            Log.w("SmartAlarm", "Widget refresh failed", e)
        }
    }

    private class Content(val title: String, val subtitle: String, val button: String, val action: PendingIntent?)

    private fun build(ctx: Context, model: WidgetModel): RemoteViews {
        val open = openApp(ctx)
        val c = when (model.mode) {
            WidgetMode.TRACKING -> Content(
                ctx.getString(R.string.tracking_title),
                ctx.getString(R.string.tracking_text, time(ctx, model.fromMs), time(ctx, model.toMs)),
                ctx.getString(R.string.widget_stop),
                broadcast(ctx, ACTION_STOP, RC_STOP),
            )
            WidgetMode.RINGING -> Content(
                ctx.getString(R.string.widget_ringing),
                "",
                ctx.getString(R.string.widget_open),
                open,
            )
            WidgetMode.IDLE -> Content(
                "Aube",
                if (model.toMs > 0L) ctx.getString(R.string.widget_next, time(ctx, model.toMs)) else "",
                ctx.getString(R.string.widget_start),
                broadcast(ctx, ACTION_START, RC_START),
            )
        }
        val views = RemoteViews(ctx.packageName, R.layout.widget_night)
        views.setTextViewText(R.id.widget_title, c.title)
        views.setTextViewText(R.id.widget_subtitle, c.subtitle)
        views.setViewVisibility(R.id.widget_subtitle, if (c.subtitle.isEmpty()) View.GONE else View.VISIBLE)
        views.setTextViewText(R.id.widget_button, c.button)
        views.setOnClickPendingIntent(R.id.widget_button, c.action)
        views.setOnClickPendingIntent(R.id.widget_info, open)
        return views
    }

    private fun openApp(ctx: Context): PendingIntent? {
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
        return PendingIntent.getActivity(ctx, RC_OPEN, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun broadcast(ctx: Context, action: String, code: Int): PendingIntent {
        val intent = Intent(ctx, NightWidgetActionReceiver::class.java).setAction(action)
        return PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
}
