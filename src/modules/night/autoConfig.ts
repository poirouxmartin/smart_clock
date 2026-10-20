/** Jours de la semaine ; index 0 = lundi (bit0 du masque). */
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const ALL_DAYS = 0x7f;
export const WEEKDAYS = 0x1f;

const pad = (n: number) => String(n).padStart(2, '0');

export function isDayOn(mask: number, dayIndex: number): boolean {
  return ((mask >> dayIndex) & 1) === 1;
}

export function toggleDay(mask: number, dayIndex: number): number {
  if (dayIndex < 0 || dayIndex >= DAY_KEYS.length) return mask;
  return mask ^ (1 << dayIndex);
}

/** Minute du jour (0..1439) -> 'HH:MM'. */
export function formatMinuteOfDay(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Décalage calendaire (heure locale) entre `now` et `ms`, et heure HH:MM de `ms`.
 * dayOffset 0 = aujourd'hui, 1 = demain, etc. Le libellé ('demain', nom du jour) est laissé à l'i18n.
 */
export function describeNextTarget(ms: number, now: number): { dayOffset: number; hhmm: string } {
  const target = new Date(ms);
  const current = new Date(now);
  const dayOffset = Math.round(
    (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
      Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())) / 86400000
  );
  return { dayOffset, hhmm: `${pad(target.getHours())}:${pad(target.getMinutes())}` };
}
