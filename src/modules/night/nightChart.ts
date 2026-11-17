/**
 * Pure model for the night chart: time on the x axis, sleep depth on the y axis,
 * hour ticks, wake window and the moment the alarm rang. No React Native import.
 */
import type { EpochState, NightSummary } from './nightAnalysis';

/** 0 = calm (deep), 1 = light, 2 = awake. Unknown epochs leave a gap. */
const LEVEL: Record<EpochState, number | null> = { calm: 0, light: 1, wake: 2, unknown: null };

export interface ChartPoint {
  t: number;
  level: number | null;
}

export interface ChartModel {
  startMs: number;
  endMs: number;
  points: ChartPoint[];
  ticks: number[];
  window: { fromMs: number; toMs: number } | null;
  targetMs: number | null;
  alarmMs: number | null;
}

const HOUR = 3600000;

/** Start time of every epoch: recorded times when known, else spread evenly over the night. */
export function epochStartTimes(s: NightSummary): number[] {
  const n = s.states.length;
  if (s.epochTimes && s.epochTimes.length === n) return s.epochTimes;
  const span = Math.max(0, s.endedAtMs - s.startedAtMs);
  return s.states.map((_, i) => s.startedAtMs + (n > 0 ? (span * i) / n : 0));
}

/** Averages levels into at most maxPoints buckets, then a 3-point moving average for a smooth curve. */
export function curvePoints(s: NightSummary, maxPoints = 150): ChartPoint[] {
  const times = epochStartTimes(s);
  const n = s.states.length;
  if (n === 0) return [];
  const size = Math.max(1, Math.ceil(n / maxPoints));
  const raw: ChartPoint[] = [];
  for (let i = 0; i < n; i += size) {
    const end = Math.min(i + size, n);
    let sum = 0;
    let known = 0;
    for (let j = i; j < end; j++) {
      const l = LEVEL[s.states[j]];
      if (l !== null) {
        sum += l;
        known++;
      }
    }
    raw.push({ t: (times[i] + times[end - 1]) / 2, level: known > 0 ? sum / known : null });
  }
  return raw.map((p, i) => {
    if (p.level === null) return p;
    const near = [raw[i - 1], p, raw[i + 1]].filter((q): q is ChartPoint => !!q && q.level !== null);
    return { t: p.t, level: near.reduce((a, q) => a + (q.level as number), 0) / near.length };
  });
}

/** Local round-time ticks inside [startMs, endMs]: every hour, 2 h for long nights, 30 min for short ones. */
export function hourTicks(startMs: number, endMs: number): number[] {
  const span = endMs - startMs;
  if (span <= 0) return [];
  const step = span > 10 * HOUR ? 2 * HOUR : span < 2 * HOUR ? HOUR / 2 : HOUR;
  const d = new Date(startMs);
  d.setMinutes(0, 0, 0);
  if (step === 2 * HOUR && d.getHours() % 2 === 1) d.setHours(d.getHours() - 1);
  const ticks: number[] = [];
  for (let t = d.getTime(); t <= endMs; t += step) {
    if (t >= startMs) ticks.push(t);
  }
  return ticks;
}

export function buildChartModel(s: NightSummary, maxPoints = 150): ChartModel {
  const target = s.targetAtMs && s.targetAtMs > 0 ? s.targetAtMs : null;
  const alarm = s.wakeAtMs && s.wakeAtMs > 0 ? s.wakeAtMs : null;
  // Keep the alarm and a close target visible even if the recording stopped just before them.
  const endMs = Math.max(s.endedAtMs, alarm ?? 0, target !== null && target - s.endedAtMs < HOUR ? target : 0);
  const windowMinutes = s.windowMinutes ?? 0;
  return {
    startMs: s.startedAtMs,
    endMs,
    points: curvePoints(s, maxPoints),
    ticks: hourTicks(s.startedAtMs, endMs),
    window: target !== null && windowMinutes > 0 ? { fromMs: target - windowMinutes * 60000, toMs: target } : null,
    targetMs: target,
    alarmMs: alarm,
  };
}
