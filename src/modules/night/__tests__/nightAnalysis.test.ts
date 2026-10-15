import { analyzeNight, NightRecord } from '../nightAnalysis';

const T0 = Date.UTC(2026, 0, 10, 23, 0, 0);
const MIN = 60000;

function makeNight(activity: number[], extra: Partial<NightRecord> = {}): NightRecord {
  return {
    sessionId: 'night_test',
    startedAtMs: T0,
    targetAtMs: T0 + 8 * 60 * MIN,
    windowMinutes: 30,
    epochMs: MIN,
    epochs: activity.map((a, i) => [T0 + (i + 1) * MIN, a, a] as [number, number, number]),
    endedAtMs: activity.length > 0 ? T0 + activity.length * MIN : null,
    wakeAtMs: null,
    wakeReason: null,
    ...extra,
  };
}

describe('analyzeNight', () => {
  it('handles an empty night', () => {
    const s = analyzeNight(makeNight([]));
    expect(s.states).toEqual([]);
    expect(s.pct).toEqual({ wake: 0, light: 0, calm: 0 });
    expect(s.signal).toBe('none');
    expect(s.sleepOnsetMs).toBeNull();
    expect(s.asleepMin).toBe(0);
    expect(s.durationMin).toBe(0);
  });

  it('flags a still night as low signal', () => {
    const s = analyzeNight(makeNight(new Array(60).fill(0)));
    expect(s.signal).toBe('low');
    expect(s.states.every(st => st === 'calm')).toBe(true);
    expect(s.pct).toEqual({ wake: 0, light: 0, calm: 100 });
    expect(s.sleepOnsetMs).toBe(T0);
    expect(s.asleepMin).toBe(60);
    expect(s.durationMin).toBe(60);
  });

  it('detects sleep onset after a restless start and classifies movement bursts', () => {
    const activity = new Array(120).fill(0);
    for (let i = 0; i < 20; i++) activity[i] = 35; // agitation prolongée
    activity[50] = 2;
    activity[51] = 2;
    activity[52] = 2; // retournements isolés
    const s = analyzeNight(makeNight(activity));
    expect(s.states.slice(0, 20).every(st => st === 'wake')).toBe(true);
    expect(s.sleepOnsetMs).toBe(T0 + 20 * MIN);
    expect(s.asleepMin).toBe(100);
    expect(s.states[50]).toBe('light');
    expect(s.states[100]).toBe('calm');
    expect(s.pct).toEqual({ wake: 17, light: 7, calm: 76 });
    expect(s.signal).toBe('ok');
    expect(s.durationMin).toBe(120);
  });

  it('classifies sustained high activity as wake', () => {
    const s = analyzeNight(makeNight(new Array(30).fill(50)));
    expect(s.states.every(st => st === 'wake')).toBe(true);
    expect(s.pct).toEqual({ wake: 100, light: 0, calm: 0 });
    expect(s.sleepOnsetMs).toBeNull();
    expect(s.asleepMin).toBe(0);
    expect(s.signal).toBe('ok');
  });

  it('computes minutes before target for a smart wake', () => {
    const wakeAt = T0 + 8 * 60 * MIN - 15 * MIN;
    const s = analyzeNight(makeNight(new Array(60).fill(0), { wakeAtMs: wakeAt, wakeReason: 'smart' }));
    expect(s.minutesBeforeTarget).toBe(15);
    expect(s.wakeReason).toBe('smart');
    expect(s.wakeAtMs).toBe(wakeAt);
  });

  it('reports 0 minutes before target for a fallback wake', () => {
    const s = analyzeNight(makeNight(new Array(60).fill(0), { wakeAtMs: T0 + 8 * 60 * MIN, wakeReason: 'fallback' }));
    expect(s.minutesBeforeTarget).toBe(0);
  });

  it('always returns integer percentages summing to 100', () => {
    const activity = [0, 0, 5, 35, 35, 35, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    const s = analyzeNight(makeNight(activity));
    expect(Number.isInteger(s.pct.wake)).toBe(true);
    expect(s.pct.wake + s.pct.light + s.pct.calm).toBe(100);
  });
});
