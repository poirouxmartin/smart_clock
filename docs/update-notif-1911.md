# Update notification (2026-11-19)

Before: the update banner only checked while Aube was open. Now a background check posts an
"Update available" notification, once per version.

## What triggers it
- `UpdateCheckJob` (JobScheduler, persisted, periodic 6 h with 1 h flex, any network) is scheduled
  each time the Home screen mounts (`scheduleUpdateCheck`); it survives reboots.
- It reads `releases/latest` of the same repo as the banner (`AppUpdater.RELEASES_API_URL`) and
  applies the same filter as `pickUpdate` (no draft/prerelease, `x.y.z` tag, `.apk` asset under
  `URL_PREFIX`), then `UpdateNotice.decide`: notify only if newer than the installed version, not
  already announced (`lastNotified` in prefs `aube_update_notice`) and notifications allowed.
  Without permission nothing is remembered, so the version is announced once allowed.
- Tapping opens `UpdateOpenActivity` (trampoline: sets a flag, opens the app). `UpdateBanner`
  consumes the flag, forces a fresh check and shows the Install / Later dialog.
- The notification is removed once the installed version reaches the announced one.
- POST_NOTIFICATIONS is asked once on Android 13+ (then the Home permission checklist remains).
- Texts: module `values/strings.xml` (English) and `values-fr/` (French, device locale).

## Manual test with adb
1. Install a build whose `versionName` is lower than the latest GitHub release.
2. Open Aube once (schedules the job, asks the permission), then:
   `adb shell cmd jobscheduler run -f com.poirouxmartin.smartclock 7301`
3. `adb logcat -s AubeUpdateNotice` shows `installed=… latest=… decision=NOTIFY`; the
   notification appears. Run step 2 again: `ALREADY_NOTIFIED`, no new notification.
4. Tap it: Aube opens on the dialog. Later hides the banner for this version, Install downloads.
5. Reset the dedup: `adb shell run-as com.poirouxmartin.smartclock rm shared_prefs/aube_update_notice.xml`
   (debug build only). Check the job: `adb shell dumpsys jobscheduler | grep -A3 7301`.

## Tests
Kotlin `UpdateNoticeTest` (version comparison, release filter, one notification per version,
permission, stale notice, schedule parameters); Jest `appUpdate.test.ts` (forced check,
once-only permission ask). Not tested on a device in this session.
