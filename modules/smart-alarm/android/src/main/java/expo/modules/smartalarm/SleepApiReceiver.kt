package expo.modules.smartalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.SleepClassifyEvent
import com.google.android.gms.location.SleepSegmentEvent

/** Receives Play Services sleep classification; a confident "asleep" pulls the next probe forward. */
class SleepApiReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmartAlarm"
        private const val MIN_CONFIDENCE = 75
        private const val PROBE_DELAY_MS = 5_000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (SleepClassifyEvent.hasEvents(intent)) {
            val last = SleepClassifyEvent.extractEvents(intent).lastOrNull() ?: return
            val now = System.currentTimeMillis()
            AutoStore.saveApiConfidence(context, last.confidence, now)
            if (AutoStore.enabled(context) &&
                AlarmStore.state(context) != AlarmStore.TRACKING &&
                last.confidence >= MIN_CONFIDENCE
            ) {
                val target = AutoStore.currentTargetMs(context)
                val inPeriod = target > now && SleepOnsetDetector.inDetectionPeriod(
                    AutoSchedule.minuteOfDay(now),
                    AutoStore.usualBedMinute(context),
                    AutoSchedule.minuteOfDay(target),
                )
                if (inPeriod) AutoManager.scheduleProbe(context, now + PROBE_DELAY_MS)
            }
        } else if (SleepSegmentEvent.hasEvents(intent)) {
            Log.d(TAG, "Sleep segment event ignored")
        }
    }
}
