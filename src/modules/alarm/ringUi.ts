import type { RingState } from '../../../modules/smart-alarm';

export type RingOverlayMode = 'ringing' | 'snoozed' | 'none';

/** Ringing wins over a pending snooze; a snooze only counts while it is still in the future. */
export function ringOverlayMode(state: RingState | null, nowMs: number): RingOverlayMode {
  if (!state) return 'none';
  if (state.ringing) return 'ringing';
  if (state.snoozeUntilMs > nowMs) return 'snoozed';
  return 'none';
}

/** Ask once per session for the full-screen alarm permission when it is missing. */
export function shouldPromptFullScreen(perms: { fullScreenIntent?: boolean } | null, alreadyPrompted: boolean): boolean {
  return perms?.fullScreenIntent === false && !alreadyPrompted;
}
