# Feedback 19/11: snooze re-ring and wake sounds

Two items from Martin's test on 19/11/2026.

## 1. Snooze did not ring a second time

**Symptom.** Martin pressed Snooze. The alarm never rang again. The button he used is unknown.

### Snooze paths

All three paths send `ACTION_SNOOZE` to `RingService`:

- Full-screen `AlarmActivity` button.
- Notification "Snooze" action (`PendingIntent.getService`, request code 2003).
- In-app `RingingOverlay` → `SmartAlarmModule.sendRingAction` → `startService`.

`RingService.snooze()` then:

1. Schedules `AlarmScheduler.scheduleSnooze` (`AlarmManager.setAlarmClock`, request code 1004, broadcast to `AlarmReceiver` with reason `"snooze"`).
2. Stores `snoozeUntilMs`.
3. Stops the ring and posts the "snoozed" notification.

`AlarmReceiver` lets reason `"snooze"` bypass state checks and calls `startForegroundService(RingService)`.

### Reproduction

Pixel emulator, debug build:

| Path | Result |
|------|--------|
| Alarm screen | Re-rang after 9 min |
| Notification action | Re-rang (light Doze forced) |
| In-app button | Exact alarm stayed registered after the app process was killed |

Not reproduced on the emulator. Deep Doze and OEM battery policies cannot be reproduced there.
**The root cause is not proven.**

### Weaknesses found by reading the code (all fixed)

Each one produces exactly "no second ring":

1. **Dropped tap.** `RingService` handled `ACTION_SNOOZE` with `if (ringing) snooze() else stopSelf()`. If the tap reaches a fresh service instance (the system restarted the process while ringing, e.g. after the overlay or notification outlived the service), `ringing` is false while the night is still `RINGING`. The tap was silently dropped and no re-ring was scheduled.
2. **Silent re-ring.** The re-ring reused the first-ring fade-in: start at 2% volume, 60 s ramp by default (up to 300 s), vibration only after the full ramp. A user who just went back to sleep can miss a re-ring that is near-silent for one to five minutes.
3. **Refused background start.** If Android refuses the foreground-service start from the alarm broadcast (background FGS restrictions, some OEMs), `AlarmReceiver` only logged the exception. No sound, no screen.

### Fix

Commit `680a401` "fix(alarm): make the snooze re-ring reliable from every snooze path".
Rules live in the pure Kotlin object `Snooze.kt`:

- `Snooze.acceptsSnooze(serviceRinging, state)`: true when the service rings **or** the stored state is `RINGING`. `RingService` uses it, so a tap always schedules the re-ring.
- `Snooze.ringStart(reason, rampMs)`:
  - Reason `"snooze"`: starts at 30% volume, ramp `min(ramp, 15 s)`, vibration immediately.
  - First ring of the morning: unchanged (2%, full ramp, vibration after the ramp).
- `Snooze.onRingStartRefused` → `FULL_SCREEN_NOTIFICATION`: `AlarmReceiver` posts a max-priority full-screen notification (`RingService.postRescue`, strings `ring_rescue_title` / `ring_rescue_text` in en and fr). Its `AlarmActivity` starts `RingService` from the foreground (extra `startRing`). `RingService` cancels it once ringing.

### Tests

`modules/smart-alarm/android/src/test/java/expo/modules/smartalarm/SnoozeReRingTest.kt` simulates the phone around the real `Snooze` rules:

- For each path (alarm screen, notification, in-app): three snoozes in a row each re-ring. Sequence is `rings, smart, snooze, snooze, snooze`, audible (volume >= 0.25) and vibrating at once.
- Re-ring still happens when the system refuses the background start (3 full-screen fallbacks).
- A tap reaching a service that lost its ring still re-rings.
- The first ring still fades in from 2%.
- Taps when nothing rings (`DONE` / `IDLE`) are ignored.

Red before the fix: 5 of 7 failed (assertion failures). Green after.
Suites: Kotlin 88 pass, Jest 147 pass.

### Limits

- Unit tests cover the rules, not AlarmManager or Doze on a real phone.
- **To confirm on Martin's phone.** Debug logs: `adb logcat -s SmartAlarm`.
- Both branches are based on local `master` `a70ffff`. `origin/master` is v1.4.5 (`5d5c82c`, widget + ghost-night repair). **A rebase is needed before release.**

## 2. Wake sounds

**Problem.** The six bundled sounds (`res/raw/nature_*.ogg`, 60 s mono loops synthesised by `scripts/generate_nature_sounds.py`) sound like noise.

### Candidates

Two real field recordings per slot. All CC0 1.0 (public domain dedication, no attribution required; credited anyway).
Source: Freesound previews, logged-out download. Wikimedia Commons candidates were blocked by HTTP 429 rate limiting.

| slot | candidate | title | author | URL | license |
|------|-----------|-------|--------|-----|---------|
| birds | A 745273 | "Bird ambience. Coniferous forest dawn chorus" | SamsterBirdies | https://freesound.org/people/SamsterBirdies/sounds/745273/ | CC0 1.0 |
| birds | B 632039 | "Dawn Chorus Rural UK" | dlt | https://freesound.org/people/dlt/sounds/632039/ | CC0 1.0 |
| stream | A 220528 | "Stream Wyre forest" | turbostream | https://freesound.org/people/turbostream/sounds/220528/ | CC0 1.0 |
| stream | B 610726 | "Running Stream with rocks" | EverydayEldritch | https://freesound.org/people/EverydayEldritch/sounds/610726/ | CC0 1.0 |
| rain | A 818347 | "Rain, late spring, drops on vegetation" | newlocknew | https://freesound.org/people/newlocknew/sounds/818347/ | CC0 1.0 |
| rain | B 725603 | "Rain Falling On The Greenhouse" | WhiteNoiseSleeper | https://freesound.org/people/WhiteNoiseSleeper/sounds/725603/ | CC0 1.0 |
| forest | A 613995 | "Forest summer day, quiet, birds and insects (Finland)" | Villehardt | https://freesound.org/people/Villehardt/sounds/613995/ | CC0 1.0 |
| forest | B 434712 | "Woodland Ambience - Duddingston Village" | BurghRecords | https://freesound.org/people/BurghRecords/sounds/434712/ | CC0 1.0 |
| waves | A 518637 | "Gentle ocean waves, birdsong and gull" | jackmichaelking | https://freesound.org/people/jackmichaelking/sounds/518637/ | CC0 1.0 |
| waves | B 325197 | "Relaxing Beach Waves" | ClubsHeartsSpadesDiamonds | https://freesound.org/people/ClubsHeartsSpadesDiamonds/sounds/325197/ | CC0 1.0 |
| storm | A 851881 | "Light thunderstorm, decrescendo, dripping" | HushAndHarmonyNow | https://freesound.org/people/HushAndHarmonyNow/sounds/851881/ | CC0 1.0 |
| storm | B 870414 | "Thunderstorm Baltic Sea" | Borgory | https://freesound.org/people/Borgory/sounds/870414/ | CC0 1.0 |

### Processing

Script: `scripts/make_sound_loop.py SRC OUT START_S` (needs `ffmpeg` and `numpy`).

```
python scripts/make_sound_loop.py <source.ogg> <out.ogg> 40
```

- Cuts 60 s from `START_S`: 40 s into the recording (28 s or 1 s for the short ones).
- Equal-power 4 s crossfade of the tail into the head, for a seamless loop.
- Mono, 44.1 kHz, 60 Hz high-pass.
- Loudness normalised to -23 LUFS (true peak -2 dB).
- Vorbis q4, about 0.5-0.6 MB each, like the current files.
- Fade-in unchanged. It is applied at playback by `RingService` (`VolumeRamp`), not baked into the files.

### Caveat

Some previews are Freesound's lower-bitrate ogg previews (about 64-80 kb/s). If Martin likes one, **re-cut it from the original file** (free account download) before shipping.

### Status

**Not shipped.** `res/raw` is unchanged.

Next steps:

1. Martin compares old and new at `C:\tmp\aube-sons-1911\index.html` and picks A or B per slot.
2. Copy the chosen files to `res/raw/nature_<slot>.ogg` (same names, no code change).
3. Replace the entries in `docs/sounds-license.md`.
