import { analyzeNight, type NightRecord, type NightSummary } from '../nightAnalysis';
import { buildChartModel, curvePoints, epochStartTimes, hourTicks } from '../nightChart';

const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m).getTime();

function record(over: Partial<NightRecord> = {}): NightRecord {
  const start = at(0, 0) - 60 * 60000; // 23:00
  const epochs: NightRecord['epochs'] = [];
  for (let i = 1; i <= 8 * 60; i++) epochs.push([start + i * 60000, i % 45 === 0 ? 40 : 0.1, 0, 1200]);
  return {
    sessionId: 's',
    startedAtMs: start,
    targetAtMs: at(7, 30),
    windowMinutes: 30,
    epochMs: 60000,
    epochs,
    endedAtMs: start + 8 * 60 * 60000,
    wakeAtMs: at(7, 0) - 12 * 60000,
    wakeReason: 'smart',
    ...over,
  };
}

describe('nightChart', () => {
  it('keeps recorded epoch times, one per state', () => {
    const s = analyzeNight(record());
    const times = epochStartTimes(s);
    expect(times).toHaveLength(s.states.length);
    expect(times[0]).toBe(s.startedAtMs);
  });

  it('spreads times evenly for summaries stored without epochTimes', () => {
    const s: NightSummary = { ...analyzeNight(record()), epochTimes: undefined };
    const times = epochStartTimes(s);
    expect(times[0]).toBe(s.startedAtMs);
    expect(times[times.length - 1]).toBeLessThan(s.endedAtMs);
  });

  it('caps the number of points and keeps levels in [0, 2]', () => {
    const pts = curvePoints(analyzeNight(record()), 100);
    expect(pts.length).toBeLessThanOrEqual(100);
    for (const p of pts) {
      expect(p.level).not.toBeNull();
      expect(p.level as number).toBeGreaterThanOrEqual(0);
      expect(p.level as number).toBeLessThanOrEqual(2);
    }
  });

  it('leaves a gap for unknown epochs', () => {
    const r = record();
    r.epochs = r.epochs.map(e => [e[0], e[1], e[2], 10]); // too few samples: unknown
    expect(curvePoints(analyzeNight(r)).every(p => p.level === null)).toBe(true);
  });

  it('puts ticks on round local hours inside the night', () => {
    const ticks = hourTicks(at(0, 0) - 40 * 60000, at(7, 14));
    expect(ticks[0]).toBe(at(0, 0));
    expect(ticks[ticks.length - 1]).toBe(at(7, 0));
    expect(ticks.every(t => new Date(t).getMinutes() === 0)).toBe(true);
  });

  it('uses half hours for short nights and 2 h for very long ones', () => {
    expect(hourTicks(at(1, 10), at(2, 40))).toEqual([at(1, 30), at(2, 0), at(2, 30)]);
    expect(hourTicks(at(0, 0) - 60 * 60000, at(11, 0)).every(t => new Date(t).getHours() % 2 === 0)).toBe(true);
  });

  it('exposes the alarm time, the target and the wake window', () => {
    const m = buildChartModel(analyzeNight(record()));
    expect(m.alarmMs).toBe(at(6, 48));
    expect(m.targetMs).toBe(at(7, 30));
    expect(m.window).toEqual({ fromMs: at(7, 0), toMs: at(7, 30) });
    expect(m.endMs).toBe(at(7, 30)); // target close to the end stays visible
  });

  it('has no alarm marker when the alarm did not ring', () => {
    const m = buildChartModel(analyzeNight(record({ wakeAtMs: 0, wakeReason: '' })));
    expect(m.alarmMs).toBeNull();
  });
});
