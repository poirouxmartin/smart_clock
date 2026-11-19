/**
 * "Later" on the update banner hides that version for a few days, across app restarts.
 * A newer version shows again at once. The Settings dot and the Settings banner ignore it.
 */
export const LATER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export interface UpdateDismissal {
  version: string;
  atMs: number;
}

export function isUpdateDismissed(d: UpdateDismissal | null | undefined, version: string, now: number): boolean {
  if (!d || d.version !== version) return false;
  // A clock set back in time must not hide the banner forever.
  if (d.atMs > now) return false;
  return now - d.atMs < LATER_SNOOZE_MS;
}

export function parseDismissal(raw: string): UpdateDismissal | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<UpdateDismissal>;
    if (typeof d.version !== 'string' || typeof d.atMs !== 'number') return null;
    return { version: d.version, atMs: d.atMs };
  } catch {
    return null;
  }
}
