import { ALL_DAYS, WEEKDAYS } from '../autoConfig';
import { RAMP_CHOICES, WINDOW_CHOICES, daysPreset, fromWheel, stepChoice } from '../wakeChoices';

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

describe('fromWheel', () => {
  it('converts hour and minute to minutes of day', () => {
    expect(fromWheel(7, 30)).toBe(450);
    expect(fromWheel(23, 57)).toBe(1435);
    expect(fromWheel(24, 0)).toBe(0);
    expect(fromWheel(6, 2)).toBe(360);
  });
});
