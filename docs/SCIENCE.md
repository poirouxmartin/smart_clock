# Science behind the smart alarm

Short, honest summary of what supports (and limits) a phone-only smart alarm.
Strength labels: **established** = consistent, replicated; **moderate** = consistent
direction, limited data; **uncertain** = mixed or thin evidence.

## 1. Which stage to wake from

- **Waking from deep sleep (N3 / slow-wave) gives the worst sleep inertia** (grogginess,
  slower reaction, poorer cognition for minutes up to ~1 h). Waking from N1/N2 is better.
  *Moderate–established.*
  - Tassi P, Muzet A. Sleep inertia. *Sleep Med Rev* 2000;4(4):341-353. doi:10.1053/smrv.2000.0098
  - Hilditch CJ, McHill AW. Sleep inertia: current insights. *Nat Sci Sleep* 2019;11:155-165. doi:10.2147/NSS.S188911
- **REM vs N2: no clear winner.** Some studies find REM awakenings feel fine, others favour N2.
  *Uncertain.* (e.g. Marzano C et al., *Neuroscience* 2011, EEG after REM vs N2 awakenings.)
- **Practical consequence:** the real target is "not N3". Cycles last ~90 min (70-120),
  N3 is concentrated in the first half of the night and REM/N2 dominate the last hours,
  so in a morning window N3 is already uncommon. *Established* (architecture);
  exact timings vary between people and nights.
  - Carskadon MA, Dement WC. Normal human sleep: an overview. In: *Principles and Practice
    of Sleep Medicine* (Kryger, Roth, Dement eds.).

## 2. Smart-alarm windows

- Commercial smart alarms use a window before the target time (commonly 20-30 min,
  often configurable). This is **product practice, not an evidence-based optimum**.
- Trials are scarce. The best controlled study found **no overall reduction of objective
  sleep inertia** with a multimodal "smart" bedroom alarm, only subgroup effects.
  *Uncertain / weak.*
  - Cheatham et al. 2024, randomized lab study of a multimodal smart alarm. PMC10969141.

App choice: default window 30 min (selectable 10/20/30/45). The latest wake is always the
target time.

## 3. What a phone alone can measure

- **Movement (actigraphy) separates sleep from wake reasonably well, but detects wake
  poorly (low specificity) and cannot identify sleep stages.** *Established.*
  - Cole RJ et al. Automatic sleep/wake identification from wrist activity. *Sleep* 1992;15(5):461-469. doi:10.1093/sleep/15.5.461
  - Sadeh A. The role and validity of actigraphy in sleep medicine: an update. *Sleep Med Rev* 2011;15(4):259-267. doi:10.1016/j.smrv.2010.10.001
  - Marino M et al. Measuring sleep: accuracy, sensitivity, and specificity of wrist
    actigraphy compared to polysomnography. *Sleep* 2013;36(11):1747-1755. doi:10.5665/sleep.3142
- **Phone-on-mattress and microphone apps agree poorly with polysomnography** for stages;
  none of the tested apps detected REM. *Moderate (consistently negative).*
  - Bhat S et al. Is there a clinical role for smartphone sleep apps? *J Clin Sleep Med*
    2015;11(7):709-715. doi:10.5664/jcsm.4840 (app tested: Sleep Time)
  - Fino E, Mazzetti M. (Not so) smart sleep tracking through the phone. *J Sleep Res*
    2020;29(1):e12935. doi:10.1111/jsr.12935
- Body movements are more frequent in light sleep, REM-wake transitions and brief
  arousals, and rare in N3. This is the rationale for "movement = good moment to wake".
  *Moderate* as a general pattern; as a stage detector it is weak (see above).

## 4. What this app does with that

- Records the accelerometer (phone on the mattress) in 1-min epochs; no microphone
  (weak added value, privacy, battery).
- In the window, rings at the first epoch whose movement is in the top 10% of the
  night so far (and above a minimum). Movement ≈ light sleep or micro-arousal, i.e.
  probably not N3. Otherwise it rings at the target time.
- Morning summary labels epochs **calm / light / wake** from movement only. "Calm" means
  "probably deeper sleep", not a measured N3; "light" mixes N1/N2/REM. These are estimates.

**Bottom line:** avoiding N3 at wake-up is well supported; phone movement can only
roughly approximate it. The alarm is a best-effort heuristic with a guaranteed fallback,
not a proven benefit.
