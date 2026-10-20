import { ALL_DAYS, DAY_KEYS, WEEKDAYS, describeNextTarget, formatMinuteOfDay, isDayOn, toggleDay } from '../autoConfig';

describe('autoConfig', () => {
  it('exposes seven day keys starting on Monday', () => {
    expect(DAY_KEYS).toHaveLength(7);
    expect(DAY_KEYS[0]).toBe('mon');
    expect(DAY_KEYS[6]).toBe('sun');
  });

  it('defines all-days and weekdays masks', () => {
    expect(ALL_DAYS).toBe(0x7f);
    expect(WEEKDAYS).toBe(0x1f);
  });

  it('isDayOn reads bit0 as Monday', () => {
    expect(isDayOn(WEEKDAYS, 0)).toBe(true);
    expect(isDayOn(WEEKDAYS, 4)).toBe(true);
    expect(isDayOn(WEEKDAYS, 5)).toBe(false);
    expect(isDayOn(ALL_DAYS, 6)).toBe(true);
    expect(isDayOn(0, 0)).toBe(false);
  });

  it('toggleDay flips a single day both ways', () => {
    expect(toggleDay(ALL_DAYS, 0)).toBe(0x7e);
    expect(toggleDay(0x7e, 0)).toBe(ALL_DAYS);
    expect(toggleDay(WEEKDAYS, 6)).toBe(WEEKDAYS | 0x40);
  });

  it('toggleDay ignores out-of-range indexes', () => {
    expect(toggleDay(WEEKDAYS, 7)).toBe(WEEKDAYS);
    expect(toggleDay(WEEKDAYS, -1)).toBe(WEEKDAYS);
  });

  it('formats minutes of day as HH:MM', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00');
    expect(formatMinuteOfDay(7 * 60 + 30)).toBe('07:30');
    expect(formatMinuteOfDay(1439)).toBe('23:59');
  });

  it('describes a target on the same day', () => {
    const now = new Date(2026, 9, 20, 22, 0).getTime();
    const target = new Date(2026, 9, 20, 23, 15).getTime();
    expect(describeNextTarget(target, now)).toEqual({ dayOffset: 0, hhmm: '23:15' });
  });

  it('describes a target tomorrow', () => {
    const now = new Date(2026, 9, 20, 22, 0).getTime();
    const target = new Date(2026, 9, 21, 7, 30).getTime();
    expect(describeNextTarget(target, now)).toEqual({ dayOffset: 1, hhmm: '07:30' });
  });

  it('counts calendar days across a week and a month boundary', () => {
    const now = new Date(2026, 9, 20, 22, 0).getTime();
    expect(describeNextTarget(new Date(2026, 9, 27, 6, 5).getTime(), now).dayOffset).toBe(7);
    const endOfMonth = new Date(2026, 9, 31, 23, 0).getTime();
    expect(describeNextTarget(new Date(2026, 10, 1, 7, 0).getTime(), endOfMonth)).toEqual({ dayOffset: 1, hhmm: '07:00' });
  });
});
