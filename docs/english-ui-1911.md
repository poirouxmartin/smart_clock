# English UI by default (2026-11-19)

Decision from Martin (2026-11-19, card 500): the app UI is in English by default. French is a
translation that follows the device language.

Branch: `dev/poiroux/english-ui-1911`, cut from `master` (`a70ffff`, v1.4.4). Not pushed.

## What changed

- **Language choice** (`src/modules/i18n/types.ts`, `I18nService.ts`): `DEFAULT_LOCALE` is now `en`.
  A new pure `resolveLocale(saved, deviceLanguages)` picks the language chosen in Settings first.
  Otherwise it picks the first *translated* language (`en`, `fr`) in the device preference list,
  then falls back to English. Before, a German phone got `de` formatting with English text.
  Before that, any phone without a saved choice got French.
- **Last hard-coded UI strings moved to i18n** (`en.ts`, `fr.ts`, screens):
  - Home header accessibility labels (`"stats"`, `"settings"`).
  - " : " glued between label and value on the Home diagnostics. This now uses `common.labelValue`:
    "Label: value" in English, "Label : value" in French.
  - " ?" glued to confirm dialogs, now `common.confirmQuestion`.
  - The `(voir console)` export alert, now `settings.exportDone`.
  - The missing English `settings.exportError`.
  - The custom sound default name, `(MP3, WAV, M4A)` and `(10s)` hints.
  - The iOS microphone prompt in `app.json`.
  - The Matter light fallback name (`Matter <id>`).
- **Android native**: already compliant. `modules/smart-alarm/.../res/values/strings.xml` is English
  and `values-fr/strings.xml` is French, with all 26 keys. No literal text is passed to
  notifications, activities or toasts.
- **Comments and internal strings in English**: cherry-picked `9436428` and `cd3618c` from
  `dev/poiroux/english-1911`. Hunks that only touch the night widget code, which is not on master,
  were dropped.

## Guard against regressions

`src/modules/i18n/__tests__/hardcodedStrings.test.ts` runs in Jest and fails on any of these:

- JSX text with letters, or a `:`/`?`/`!` glued with spaces, in any `src/**/*.tsx` or `App.tsx`.
- Literal strings in user-facing props (`title`, `label`, `placeholder`, `accessibilityLabel`, ...)
  and in `Alert.alert` arguments.
- English/French key mismatch in the JS locales.
- An Android `values/strings.xml` without a full `values-fr` translation, or with French text in
  the default file.
- `android:text|label|title|hint|contentDescription` literals in layouts or manifests.
- Literal text passed by Kotlin to `setContentTitle`, `setText`, `Toast.makeText`,
  `NotificationChannel`, and similar calls.

Allowed literals: two-letter language codes (`FR`/`EN` chips), colour temperatures (`3000K`) and
clock separators (`07:30`).

## Verification

- Jest: 13 suites, 147 tests pass (8 new).
- Kotlin unit tests (`:smart-alarm:testDebugUnitTest`): 81 pass.
- `tsc --noEmit`: no new error. The only errors are pre-existing ones in `light-controller`.
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` builds. The JS is not embedded,
  so it was run with Metro.
- Emulator `Pixel_8` (Android 17 beta, device language en-US). Screenshots are in
  `C:\tmp\aube-english-ui-1911\`:
  - `en-home.png`, `en-settings.png`, `en-night-summary.png`, `en-notifications.png`: English
    everywhere, including the native "Alarm Tomorrow at 7:30 AM" notification.
  - `fr-home.png`, `fr-settings.png`, `fr-notifications.png`: after
    `cmd locale set-app-locales ... fr-FR` (Android per-app language). The app starts in French on
    its own (`[I18nService] Initialized with locale: fr`) and the native notification reads
    "Réveil demain à 07:30".

## Known limits

- The FR/EN chip in Settings changes the JS UI only. Native notifications, the ringing screen and
  the dawn screen keep following the device (or per-app) language. Syncing them would need
  `AppCompatDelegate.setApplicationLocales` from the chip.
- Existing users who never touched the chip, on a French phone, still see French. Users on an
  English phone now see English.
- The English upcoming notification capitalises the day mid-sentence ("Alarm Tomorrow at..."). This
  comes from `DateUtils` and predates this change.
- The diagnostic line "Last error" shows the raw Java exception text, which is not translated.
- `dev/poiroux/english-1911` and `dev/poiroux/widget-nuit-1811` are not on master. Merging the
  widget later may need its new strings to pass the guard, which checks both languages.
