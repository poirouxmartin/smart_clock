# Aube - smart alarm clock (Android)

An alarm that rings at the "lightest" moment of a window before the target time, based on
the movements recorded by the phone lying on the mattress. At the latest, it always rings
at the target time.

Since 1.3.0: automatic sleep-onset detection (no button), a dawn light before the alarm,
and nature sounds.

Formerly "Smart Clock". The Android id `com.poirouxmartin.smartclock` is kept: new versions install over the old ones without losing recorded nights.

## Installation

Download the `aube-vX.Y.Z.apk` file of the latest version from the
[releases page](https://github.com/poirouxmartin/smart_clock/releases/latest), then open
it on the phone (Android 7 or later; allow installing unknown apps if Android asks). New
versions install over the old ones, and the app offers its own updates from 1.4.1 on.

## Disclaimer

Personal project, provided as is, without any warranty. This is not a medical device: the
sleep phases shown are estimates based on the phone's movements. Do not use it as your only
alarm for an important appointment until you have verified it on your own phone.

## Usage

1. Home: set the target time, the days and the window (10/20/30/45 min, 30 by default).
   "Automatic detection" is on by default; it can be turned off.
2. Fix the permissions the app reports (exact alarms, full-screen notifications,
   notifications; battery optimisation recommended; physical activity optional for
   automatic detection).
3. Automatic mode: nothing to do in the evening, the app detects sleep onset (see below).
   Manual mode: "Start the night now", then place the phone on the mattress, plugged in.
   The screen can be off.
4. On waking, tap "Stop": the night summary is shown (duration, estimated calm/light/awake
   phases, wake type).

"Test the alarm" rings the alarm after 10 s, so you can check the sound and the display on
the lock screen.

## How it works

- `modules/smart-alarm`: native Kotlin module (local Expo module).
  - Fallback alarm `AlarmManager.setAlarmClock` at the target time: exact, works in Doze,
    with the app killed, and after a reboot (re-armed at boot).
  - `SleepTrackingService`: foreground service, accelerometer at 20 Hz, one-minute epochs,
    local JSON night file.
  - `WakeDecider`: wake decision within the window (see "Wake window").
  - `RingService` + `AlarmActivity`: ringing with the "alarm" usage, gradual volume ramp,
    vibration, full screen over the lock screen.
  - `AutoManager`, `ProbeReceiver`, `SleepApiReceiver`, `SleepOnsetDetector`: automatic
    sleep-onset detection (see "Automatic detection").
  - `AutoSchedule`, `UsualBedtime`: daily schedule and usual bedtime.
  - `DawnActivity`, `DawnCurve`: dawn light (see "Dawn light").
  - `VolumeRamp`, `NatureSound`: nature sounds and volume ramp (see "Nature sounds").
- Home screen widget "Nuit Aube": start or stop the night in one tap, shows the state and the wake time.
- `src/modules/night`: night analysis (JS) and summaries stored in SQLite.
- Science and limits: [docs/SCIENCE.md](docs/SCIENCE.md), rationale for the wake logic:
  [docs/science-reveil.md](docs/science-reveil.md). Project state:
  [docs/STATE.md](docs/STATE.md).

### Automatic detection

A daily alarm is armed for the chosen time and days. It rings even if no sleep onset was
detected.

- Usual bedtime: circular median of the last 14 detected sleep onsets, 23:00 by default.
- From about 3 h before the usual bedtime until 1 h before the alarm, an exact alarm "probes"
  the phone every 15 min for 5 s: screen state, charge, accelerometer stillness, ambient
  light, and the latest "sleep" confidence from the Google Play Services Sleep API
  (`ACTIVITY_RECOGNITION` permission, optional).
- Weighted score: Sleep API 0.45 · stillness 0.25 · darkness 0.15 · usual bedtime
  0.10 · charge 0.05. Screen on = veto.
- 2 consecutive probes at 0.6 or more: sleep onset = first probe of the series.
  Accelerometer night tracking then starts (foreground service, allowed because it is
  launched by an exact alarm).
- False start (wake-up within 45 min of the sleep onset): the night is cancelled and
  detection resumes.
- Natural wake-up within 90 min before the window: notification "Already awake?" with the
  "Cancel the alarm" button.
- The "Start the night now" button remains available.
- Battery: no continuous sensing during the day; about 12 short probes per evening. The
  Sleep API is computed by Play Services. System or manufacturer battery optimisations can
  delay the probes.

### Dawn light

- `DawnActivity` is shown over the lock screen from 30 min before the alarm
  (15, 30 or 45 min, as chosen).
- Screen brightness from 1% to 100% (quadratic curve), colour from dark red to orange, then
  warm white.
- Optional torch, in the last 20% of the dawn (intensity levels on Android 13 and later,
  API 33). Off by default.
- A tap on the screen turns it off. The dawn ends with the ringing.

### Nature sounds

- Birds, waves, forest, rain, stream, storm: seamless 60 s loops, synthesised by
  `scripts/generate_nature_sounds.py` (CC0, see
  [docs/sounds-license.md](docs/sounds-license.md)). No system ringtone.
- Perceptual (exponential) volume ramp from 2% over 60 s by default (30, 60 or 120 s).
- For nature sounds, the vibration starts only after the ramp.
- Preview button in the sound settings.

### Wake window

`WakeDecider.decide`: 30 min window by default. Within the window, the alarm rings as soon as:

- (a) a movement above the personal threshold (90th percentile of the movements of the night
  before the window, minimum 1.0);
- (b) sustained movement: 2 epochs out of the last 3 at 0.6 × threshold or more;
- (c) a Sleep API confidence of 30 or less, with some movement.

The threshold is multiplied by 0.85 near a 90 min cycle boundary (±15 min), after the
estimated sleep onset (manual night: sleep onset = start + 15 min). Without signal, the
alarm rings at the target time.

Rationale: [docs/science-reveil.md](docs/science-reveil.md).

## Development

```bash
npm install
npm test                      # jest: 139 tests, 11 suites
npx tsc --noEmit              # the main flow is typed; some legacy code still errors
cd android && ./gradlew :smart-alarm:testDebugUnitTest assembleRelease   # 64 Kotlin tests
```

Kotlin tests: `WakeDecider`, `SleepOnsetDetector`, `AutoSchedule`, `UsualBedtime`,
`DawnCurve`, `VolumeRamp`, `NatureSound`.

Icons: `python scripts/generate_icons.py` regenerates `assets/` and the Android mipmaps from a vector drawing (rising sun over the horizon).

`android/` is versioned (release signing config): do not run
`expo prebuild --clean`, which would overwrite it. Release: push a `v*` tag and the CI
(`.github/workflows/release-apk.yml`) publishes the APK signed with the release key. Locally,
without `keystore.properties`, the APK is signed with the debug key.

## Licence

MIT, see [LICENSE](LICENSE). Nature sounds: CC0, see
[docs/sounds-license.md](docs/sounds-license.md).
