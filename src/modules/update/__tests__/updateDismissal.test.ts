import { isUpdateDismissed, LATER_SNOOZE_MS, parseDismissal } from '../updateDismissal';

describe('update "Later" dismissal', () => {
  const now = 1_800_000_000_000;

  it('hides the same version during the snooze period', () => {
    expect(isUpdateDismissed({ version: '1.4.8', atMs: now - 1000 }, '1.4.8', now)).toBe(true);
    expect(isUpdateDismissed({ version: '1.4.8', atMs: now - LATER_SNOOZE_MS + 1 }, '1.4.8', now)).toBe(true);
  });

  it('shows it again once the snooze period is over', () => {
    expect(isUpdateDismissed({ version: '1.4.8', atMs: now - LATER_SNOOZE_MS }, '1.4.8', now)).toBe(false);
  });

  it('shows a newer version at once', () => {
    expect(isUpdateDismissed({ version: '1.4.8', atMs: now - 1000 }, '1.4.9', now)).toBe(false);
  });

  it('shows the banner when nothing was dismissed or the clock went back', () => {
    expect(isUpdateDismissed(null, '1.4.8', now)).toBe(false);
    expect(isUpdateDismissed({ version: '1.4.8', atMs: now + 60_000 }, '1.4.8', now)).toBe(false);
  });

  it('parses only well-formed stored values', () => {
    expect(parseDismissal('')).toBeNull();
    expect(parseDismissal('not json')).toBeNull();
    expect(parseDismissal('{"version":1}')).toBeNull();
    expect(parseDismissal('{"version":"1.4.8","atMs":5}')).toEqual({ version: '1.4.8', atMs: 5 });
  });
});
