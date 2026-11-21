import { ALL_DAYS, WEEKDAYS } from '../autoConfig';
import { RAMP_CHOICES, WINDOW_CHOICES, dayTarget, daysPreset, fromWheel, nextTargetMs, stepChoice } from '../wakeChoices';

describe('stepChoice', () => {
  it('moves to the next and previous choice', () => {
    expect(stepChoice(WINDOW_CHOICES, 20, 1)).toBe(30);
    expect(stepChoice(WINDOW_CHOICES, 20, -1)).toBe(10);
  });

  it('clamps at both ends', () => {
    expect(stepChoice(WINDOW_CHOICES, 45, 1)).toBe(45);
    expect(stepChoice(RAMP_CHOICES, 30, -1)).toBe(30);
  });

  it('moves an off-list value to its nearest neighbour', () => {
    expect(stepChoice(WINDOW_CHOICES, 25, 1)).toBe(30);
    expect(stepChoice(WINDOW_CHOICES, 25, -1)).toBe(20);
    expect(stepChoice(WINDOW_CHOICES, 90, -1)).toBe(45);
    expect(stepChoice(WINDOW_CHOICES, 5, 1)).toBe(10);
  });
});

describe('daysPreset', () => {
  it('recognises the presets', () => {
    expect(daysPreset(ALL_DAYS)).toBe('everyDay');
    expect(daysPreset(WEEKDAYS)).toBe('weekdays');
  });

  it('anything else is custom', () => {
    expect(daysPreset(0b0000111)).toBe('custom');
    expect(daysPreset(0)).toBe('custom');
  });
});

describe('nextTargetMs with per-day times', () => {
  // 2026-10-23 is a Friday; local time on both sides, so the zone does not matter.
  const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m, 0, 0);
  const sat = [-1, -1, -1, -1, -1, 9 * 60 + 30, -1];

  it('behaves as before without overrides', () => {
    expect(nextTargetMs(420, at(23, 6, 0))).toBe(at(23, 7, 0).getTime());
    expect(nextTargetMs(420, at(23, 8, 0))).toBe(at(24, 7, 0).getTime());
  });

  it('uses the override of the weekday it lands on', () => {
    expect(nextTargetMs(420, at(23, 8, 0), sat)).toBe(at(24, 9, 30).getTime());
    expect(nextTargetMs(420, at(24, 10, 0), sat)).toBe(at(25, 7, 0).getTime());
  });

  it('dayTarget falls back to the default for -1 or missing', () => {
    expect(dayTarget(420, sat, 5)).toBe(570);
    expect(dayTarget(420, sat, 0)).toBe(420);
    expect(dayTarget(420, undefined, 5)).toBe(420);
  });
});

describe('fromWheel', () => {
  it('converts hour and minute to minutes of day', () => {
    expect(fromWheel(7, 30)).toBe(450);
    expect(fromWheel(23, 57)).toBe(1435);
    expect(fromWheel(24, 0)).toBe(0);
    expect(fromWheel(6, 2)).toBe(360);
  });
});
