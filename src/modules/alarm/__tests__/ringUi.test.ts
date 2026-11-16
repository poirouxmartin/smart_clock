import { ringOverlayMode, shouldPromptFullScreen } from '../ringUi';

const state = (ringing: boolean, snoozeUntilMs: number) => ({ ringing, reason: 'smart', snoozeUntilMs });

describe('ringOverlayMode', () => {
  it('is none without state', () => {
    expect(ringOverlayMode(null, 1000)).toBe('none');
  });

  it('is ringing when ringing', () => {
    expect(ringOverlayMode(state(true, 0), 1000)).toBe('ringing');
  });

  it('ringing wins over a pending snooze', () => {
    expect(ringOverlayMode(state(true, 5000), 1000)).toBe('ringing');
  });

  it('is snoozed while the snooze is in the future', () => {
    expect(ringOverlayMode(state(false, 5000), 1000)).toBe('snoozed');
  });

  it('is none once the snooze time is reached or unset', () => {
    expect(ringOverlayMode(state(false, 1000), 1000)).toBe('none');
    expect(ringOverlayMode(state(false, 0), 1000)).toBe('none');
  });
});

describe('shouldPromptFullScreen', () => {
  it('prompts when the permission is missing and not yet prompted', () => {
    expect(shouldPromptFullScreen({ fullScreenIntent: false }, false)).toBe(true);
  });

  it('does not prompt twice', () => {
    expect(shouldPromptFullScreen({ fullScreenIntent: false }, true)).toBe(false);
  });

  it('does not prompt when granted, unknown or no perms', () => {
    expect(shouldPromptFullScreen({ fullScreenIntent: true }, false)).toBe(false);
    expect(shouldPromptFullScreen({}, false)).toBe(false);
    expect(shouldPromptFullScreen(null, false)).toBe(false);
  });
});
