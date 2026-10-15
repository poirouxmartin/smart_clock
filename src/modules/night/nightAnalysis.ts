/**
 * Analyse pure d'une nuit enregistrée par le module natif smart-alarm.
 * Estimation à partir de l'actimétrie (mouvements), pas de phases EEG.
 * Aucun import React Native : module testable sous Jest.
 */

export type EpochState = 'wake' | 'light' | 'calm';

/** Format natif : une époque = [tMs, activity, maxDelta]. */
export interface NightRecord {
  sessionId: string;
  startedAtMs: number;
  targetAtMs: number;
  windowMinutes: number;
  epochMs: number;
  epochs: Array<[number, number, number]>;
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
  pct: { wake: number; light: number; calm: number };
  signal: 'ok' | 'low' | 'none';
}

const WAKE_T = 30;
const MOVE_T = 1.0;
const WINDOW = 2;
const ONSET_RUN = 10;
const ONSET_SUM_MAX = ONSET_RUN * MOVE_T * 3;
const DEFAULT_EPOCH_MS = 60000;

export function analyzeNight(night: NightRecord): NightSummary {
  const epochMs = night.epochMs > 0 ? night.epochMs : DEFAULT_EPOCH_MS;
  const n = night.epochs.length;
  const activity = night.epochs.map(e => e[1]);
  const lastT = n > 0 ? night.epochs[n - 1][0] : night.startedAtMs;
  const endedAtMs = night.endedAtMs && night.endedAtMs > 0 ? night.endedAtMs : lastT;
  const durationMin = Math.round((endedAtMs - night.startedAtMs) / 60000);

  // Classification par époque
  const isMoving = (j: number) => j >= 0 && j < n && activity[j] >= MOVE_T;
  const states: EpochState[] = [];
  for (let i = 0; i < n; i++) {
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
      if (states[j] === 'wake') {
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
    for (let i = 0; i < onsetIdx; i++) states[i] = 'wake';
  }
  const sleepOnsetMs = onsetIdx >= 0 ? night.epochs[onsetIdx][0] - epochMs : null;

  let asleepEpochs = 0;
  for (let i = onsetIdx >= 0 ? onsetIdx : 0; i < n; i++) {
    if (states[i] !== 'wake') asleepEpochs++;
  }
  const asleepMin = Math.round((asleepEpochs * epochMs) / 60000);

  // Qualité du signal
  let movedCount = 0;
  let maxActivity = 0;
  for (const a of activity) {
    if (a >= MOVE_T) movedCount++;
    if (a > maxActivity) maxActivity = a;
  }
  const signal: NightSummary['signal'] =
    n === 0 ? 'none' : movedCount < 0.03 * n && maxActivity < 2 ? 'low' : 'ok';

  // Pourcentages entiers (méthode des plus grands restes) : somme = 100
  const pct = { wake: 0, light: 0, calm: 0 };
  if (n > 0) {
    const counts = { wake: 0, light: 0, calm: 0 };
    for (const st of states) counts[st]++;
    const keys: Array<keyof typeof pct> = ['wake', 'light', 'calm'];
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
  };
}
