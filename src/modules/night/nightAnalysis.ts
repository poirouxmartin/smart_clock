/**
 * Analyse pure d'une nuit enregistrée par le module natif smart-alarm.
 * Estimation à partir de l'actimétrie (mouvements), pas de phases EEG.
 * Aucun import React Native : module testable sous Jest.
 */

export type EpochState = 'wake' | 'light' | 'calm' | 'unknown';

/** Format natif : une époque = [tMs, activity, maxDelta, samples?]. samples absent ou -1 = inconnu. */
export interface NightRecord {
  sessionId: string;
  startedAtMs: number;
  targetAtMs: number;
  windowMinutes: number;
  epochMs: number;
  epochs: Array<[number, number, number] | [number, number, number, number]>;
  endedAtMs: number | null;
  wakeAtMs: number | null;
  wakeReason: string | null;
}

export interface NightSummary {
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMin: number;
  sleepOnsetMs: number | null;
  asleepMin: number;
  wakeAtMs: number | null;
  wakeReason: string | null;
  minutesBeforeTarget: number;
  states: EpochState[];
  pct: { wake: number; light: number; calm: number; unknown: number };
  signal: 'ok' | 'low' | 'none' | 'nosensor';
  /** Absent in summaries stored before 1.4.3. */
  targetAtMs?: number;
  windowMinutes?: number;
  /** Start time of each epoch, aligned with states. */
  epochTimes?: number[];
}

const WAKE_T = 30;
const MOVE_T = 1.0;
const WINDOW = 2;
const ONSET_RUN = 10;
const ONSET_SUM_MAX = ONSET_RUN * MOVE_T * 3;
const DEFAULT_EPOCH_MS = 60000;
const MIN_SAMPLES = 120; // ~1200 attendus à 20 Hz par époque de 60 s
const HANDLING_EPOCHS = 10; // manipulation du téléphone au coucher / à l'alarme

const samplesOf = (e: NightRecord['epochs'][number]): number => (e.length > 3 ? (e[3] as number) : -1);

/** Statistiques du capteur pour un affichage de diagnostic. */
export function sensorStats(night: NightRecord): { knownEpochs: number; meanSamples: number | null } {
  let known = 0;
  let sum = 0;
  for (const e of night.epochs) {
    const s = samplesOf(e);
    if (s >= 0) {
      known++;
      sum += s;
    }
  }
  return { knownEpochs: known, meanSamples: known > 0 ? sum / known : null };
}

export function analyzeNight(night: NightRecord): NightSummary {
  const epochMs = night.epochMs > 0 ? night.epochMs : DEFAULT_EPOCH_MS;
  const n = night.epochs.length;
  const activity = night.epochs.map(e => e[1]);
  const lastT = n > 0 ? night.epochs[n - 1][0] : night.startedAtMs;
  const endedAtMs = night.endedAtMs && night.endedAtMs > 0 ? night.endedAtMs : lastT;
  const durationMin = Math.round((endedAtMs - night.startedAtMs) / 60000);

  // Classification par époque
  const unknown = night.epochs.map(e => {
    const s = samplesOf(e);
    return s >= 0 && s < MIN_SAMPLES;
  });
  const isMoving = (j: number) => j >= 0 && j < n && !unknown[j] && activity[j] >= MOVE_T;
  const states: EpochState[] = [];
  for (let i = 0; i < n; i++) {
    if (unknown[i]) {
      states.push('unknown');
      continue;
    }
    let moveCount = 0;
    for (let j = i - WINDOW; j <= i + WINDOW; j++) {
      if (isMoving(j)) moveCount++;
    }
    if (activity[i] >= WAKE_T && moveCount >= 3) {
      states.push('wake');
    } else if (moveCount > 0) {
      states.push('light');
    } else {
      states.push('calm');
    }
  }

  // Début de sommeil : premier bloc de 10 époques non éveillées et peu actives
  let onsetIdx = -1;
  for (let k = 0; k + ONSET_RUN <= n; k++) {
    let ok = true;
    let sum = 0;
    for (let j = k; j < k + ONSET_RUN; j++) {
      if (states[j] === 'wake' || states[j] === 'unknown') {
        ok = false;
        break;
      }
      sum += activity[j];
    }
    if (ok && sum < ONSET_SUM_MAX) {
      onsetIdx = k;
      break;
    }
  }
  if (onsetIdx >= 0) {
    for (let i = 0; i < onsetIdx; i++) if (states[i] !== 'unknown') states[i] = 'wake';
  }
  const sleepOnsetMs = onsetIdx >= 0 ? night.epochs[onsetIdx][0] - epochMs : null;

  let asleepEpochs = 0;
  for (let i = onsetIdx >= 0 ? onsetIdx : 0; i < n; i++) {
    if (states[i] !== 'wake' && states[i] !== 'unknown') asleepEpochs++;
  }
  const asleepMin = Math.round((asleepEpochs * epochMs) / 60000);

  // Qualité du signal
  const unknownCount = unknown.filter(Boolean).length;
  const hasKnownSamples = night.epochs.some(e => samplesOf(e) >= 0);
  let signal: NightSummary['signal'];
  if (n === 0) {
    signal = 'none';
  } else if (hasKnownSamples && unknownCount >= 0.5 * n) {
    signal = 'nosensor';
  } else {
    const trim = n > 2 * HANDLING_EPOCHS + 10 ? HANDLING_EPOCHS : 0;
    let coreCount = 0;
    let movedCount = 0;
    let maxActivity = 0;
    for (let i = trim; i < n - trim; i++) {
      if (unknown[i]) continue;
      coreCount++;
      if (activity[i] >= MOVE_T) movedCount++;
      if (activity[i] > maxActivity) maxActivity = activity[i];
    }
    signal = movedCount < 0.03 * coreCount && maxActivity < 2 ? 'low' : 'ok';
  }

  // Pourcentages entiers (méthode des plus grands restes) : somme = 100
  const pct = { wake: 0, light: 0, calm: 0, unknown: 0 };
  if (n > 0) {
    const counts = { wake: 0, light: 0, calm: 0, unknown: 0 };
    for (const st of states) counts[st]++;
    const keys: Array<keyof typeof pct> = ['wake', 'light', 'calm', 'unknown'];
    const raw = keys.map(k => (counts[k] * 100) / n);
    const floors = raw.map(Math.floor);
    let remaining = 100 - floors.reduce((a, b) => a + b, 0);
    const order = raw
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac)
      .map(x => x.idx);
    for (const idx of order) {
      if (remaining <= 0) break;
      floors[idx] += 1;
      remaining--;
    }
    keys.forEach((k, idx) => {
      pct[k] = floors[idx];
    });
  }

  const hasSmartOrTestWake = !!night.wakeAtMs && night.wakeReason !== 'fallback';
  const minutesBeforeTarget = hasSmartOrTestWake
    ? Math.round((night.targetAtMs - (night.wakeAtMs as number)) / 60000)
    : 0;

  return {
    sessionId: night.sessionId,
    startedAtMs: night.startedAtMs,
    endedAtMs,
    durationMin,
    sleepOnsetMs,
    asleepMin,
    wakeAtMs: night.wakeAtMs || null,
    wakeReason: night.wakeReason ?? null,
    minutesBeforeTarget,
    states,
    pct,
    signal,
    targetAtMs: night.targetAtMs,
    windowMinutes: night.windowMinutes,
    epochTimes: night.epochs.map(e => e[0] - epochMs),
  };
}
