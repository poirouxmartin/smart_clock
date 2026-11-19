import { ALL_DAYS, WEEKDAYS } from './autoConfig';

export const WINDOW_CHOICES = [10, 20, 30, 45];
export const RAMP_CHOICES = [30, 60, 120];
export const DAWN_CHOICES = [15, 30, 45];
export const DEFAULT_NIGHT_SETTINGS = { targetMinutes: 7 * 60 + 30, windowMinutes: 30, auto: true, daysMask: ALL_DAYS };
export type NightSettings = typeof DEFAULT_NIGHT_SETTINGS;
export const NIGHT_SETTINGS_KEY = 'night_settings';

/**
 * Next or previous value of an ordered list of choices, clamped at both ends.
 * A value that is not in the list (old setting) moves to its nearest neighbour in that direction.
 */
export function stepChoice(choices: readonly number[], current: number, dir: 1 | -1): number {
  if (choices.length === 0) return current;
  if (dir > 0) return choices.find(v => v > current) ?? choices[choices.length - 1];
  for (let i = choices.length - 1; i >= 0; i--) if (choices[i] < current) return choices[i];
  return choices[0];
}

export type DaysPreset = 'everyDay' | 'weekdays' | 'custom';

export function daysPreset(mask: number): DaysPreset {
  const m = mask & ALL_DAYS;
  if (m === ALL_DAYS) return 'everyDay';
  if (m === WEEKDAYS) return 'weekdays';
  return 'custom';
}

export const PRESET_MASKS: Record<Exclude<DaysPreset, 'custom'>, number> = { everyDay: ALL_DAYS, weekdays: WEEKDAYS };

/** Next occurrence of HH:MM: today if still in the future, otherwise tomorrow. */
export function nextTargetMs(minutesOfDay: number, now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM of a timestamp, local time. */
export function hm(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minutes of day from a wheel pick; minutes snap to the 5-minute grid the wheel shows. */
export function fromWheel(hour: number, minute: number): number {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = Math.min(55, Math.max(0, Math.round(minute / 5) * 5));
  return h * 60 + m;
}
