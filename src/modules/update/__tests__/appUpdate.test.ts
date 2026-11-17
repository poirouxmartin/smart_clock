import {
  APK_URL_PREFIX,
  CHECK_INTERVAL_MS,
  RETRY_AFTER_FAILURE_MS,
  checkForUpdate,
  compareVersions,
  pickUpdate,
  type AvailableUpdate,
  type UpdateStore,
} from '../appUpdate';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: [
    { name: 'notes.txt', browser_download_url: `${APK_URL_PREFIX}${tag}/notes.txt` },
    { name: `aube-${tag}.apk`, browser_download_url: `${APK_URL_PREFIX}${tag}/aube-${tag}.apk` },
  ],
  ...extra,
});

function memoryStore(init: { lastCheck?: number; cached?: AvailableUpdate | null } = {}) {
  const state = { lastCheck: init.lastCheck ?? 0, cached: init.cached ?? null };
  const store: UpdateStore = {
    getLastCheck: async () => state.lastCheck,
    setLastCheck: async ms => {
      state.lastCheck = ms;
    },
    getCached: async () => state.cached,
    setCached: async u => {
      state.cached = u;
    },
  };
  return { state, store };
}

describe('compareVersions', () => {
  it('compares numerically per segment', () => {
    expect(compareVersions('1.4.1', '1.4.0')).toBe(1);
    expect(compareVersions('v1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.4.0', 'v1.4.0')).toBe(0);
    expect(compareVersions('1.4', '1.3.9')).toBe(1);
    expect(compareVersions('1.3.9', '1.4')).toBe(-1);
  });
});

describe('pickUpdate', () => {
  it('returns the apk of a valid release', () => {
    expect(pickUpdate(release('v1.4.1'))).toEqual({
      version: '1.4.1',
      url: `${APK_URL_PREFIX}v1.4.1/aube-v1.4.1.apk`,
    });
  });

  it('rejects drafts, prereleases and non-objects', () => {
    expect(pickUpdate(release('v1.4.1', { draft: true }))).toBeNull();
    expect(pickUpdate(release('v1.4.1', { prerelease: true }))).toBeNull();
    expect(pickUpdate(null)).toBeNull();
    expect(pickUpdate('x')).toBeNull();
  });

  it('rejects a release without apk asset', () => {
    expect(pickUpdate(release('v1.4.1', { assets: [{ name: 'a.zip', browser_download_url: `${APK_URL_PREFIX}a.zip` }] }))).toBeNull();
  });

  it('rejects an apk hosted elsewhere', () => {
    const assets = [{ name: 'aube.apk', browser_download_url: 'https://evil.example.com/aube.apk' }];
    expect(pickUpdate(release('v1.4.1', { assets }))).toBeNull();
  });

  it('rejects a bad or missing tag', () => {
    expect(pickUpdate(release('latest'))).toBeNull();
    expect(pickUpdate(release('v1.4'))).toBeNull();
    expect(pickUpdate(release('v1.4.1', { tag_name: undefined }))).toBeNull();
  });
});

describe('checkForUpdate', () => {
  const now = 1_000_000_000_000;
  const update: AvailableUpdate = { version: '1.4.1', url: `${APK_URL_PREFIX}v1.4.1/aube-v1.4.1.apk` };

  it('finds a newer release and records the check', async () => {
    const { state, store } = memoryStore();
    const fetchRelease = jest.fn().mockResolvedValue(release('v1.4.1'));
    const res = await checkForUpdate({ installedVersion: '1.4.0', now, store, fetchRelease });
    expect(res).toEqual(update);
    expect(state.lastCheck).toBe(now);
    expect(state.cached).toEqual(update);
  });

  it('uses the cache within the interval, then refetches after', async () => {
    const { store } = memoryStore();
    const fetchRelease = jest.fn().mockResolvedValue(release('v1.4.1'));
    await checkForUpdate({ installedVersion: '1.4.0', now, store, fetchRelease });
    const again = await checkForUpdate({ installedVersion: '1.4.0', now: now + 1000, store, fetchRelease });
    expect(fetchRelease).toHaveBeenCalledTimes(1);
    expect(again).toEqual(update);
    await checkForUpdate({ installedVersion: '1.4.0', now: now + CHECK_INTERVAL_MS + 1, store, fetchRelease });
    expect(fetchRelease).toHaveBeenCalledTimes(2);
  });

  it('returns null when the release equals the installed version', async () => {
    const { store } = memoryStore();
    const fetchRelease = jest.fn().mockResolvedValue(release('v1.4.0'));
    expect(await checkForUpdate({ installedVersion: '1.4.0', now, store, fetchRelease })).toBeNull();
  });

  it('retries a failed check after RETRY_AFTER_FAILURE_MS, not a full interval', async () => {
    const { store } = memoryStore();
    const fetchRelease = jest.fn().mockRejectedValue(new Error('HTTP 404'));
    expect(await checkForUpdate({ installedVersion: '1.4.0', now, store, fetchRelease })).toBeNull();
    await checkForUpdate({ installedVersion: '1.4.0', now: now + RETRY_AFTER_FAILURE_MS - 1000, store, fetchRelease });
    expect(fetchRelease).toHaveBeenCalledTimes(1);
    // e.g. the repo was private (404) and is public now: the update shows up half an hour later
    fetchRelease.mockResolvedValue(release('v1.4.1'));
    const res = await checkForUpdate({ installedVersion: '1.4.0', now: now + RETRY_AFTER_FAILURE_MS + 1000, store, fetchRelease });
    expect(fetchRelease).toHaveBeenCalledTimes(2);
    expect(res).toEqual(update);
  });

  it('keeps offering a cached update while offline', async () => {
    const { store } = memoryStore({ lastCheck: now - CHECK_INTERVAL_MS - 1, cached: update });
    const fetchRelease = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await checkForUpdate({ installedVersion: '1.4.0', now, store, fetchRelease })).toEqual(update);
  });

  it('ignores a cached update once it is installed', async () => {
    const { store } = memoryStore({ lastCheck: now, cached: update });
    const fetchRelease = jest.fn();
    expect(await checkForUpdate({ installedVersion: '1.4.1', now: now + 1000, store, fetchRelease })).toBeNull();
    expect(fetchRelease).not.toHaveBeenCalled();
  });
});
