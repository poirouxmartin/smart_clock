import { APK_URL_PREFIX, checkForUpdate, fetchLatestRelease, pickUpdate } from '../appUpdate';

// The releases repo is configurable (AppUpdater.RELEASES_REPO), e.g. a future public aube-releases.
describe('configurable releases repo', () => {
  const OTHER = 'https://github.com/poirouxmartin/aube-releases/releases/download/';
  const otherRelease = {
    tag_name: 'v1.4.1',
    assets: [{ name: 'aube-v1.4.1.apk', browser_download_url: `${OTHER}v1.4.1/aube-v1.4.1.apk` }],
  };

  it('picks the asset only from the configured prefix', () => {
    expect(pickUpdate(otherRelease, OTHER)).toEqual({ version: '1.4.1', url: `${OTHER}v1.4.1/aube-v1.4.1.apk` });
    expect(pickUpdate(otherRelease)).toBeNull();
  });

  it('ignores a cached update from a previous repo', async () => {
    const store = {
      getLastCheck: async () => 1000,
      setLastCheck: async () => {},
      getCached: async () => ({ version: '1.4.1', url: `${APK_URL_PREFIX}v1.4.1/aube-v1.4.1.apk` }),
      setCached: async () => {},
    };
    const fetchRelease = jest.fn();
    const r = await checkForUpdate({ installedVersion: '1.4.0', now: 2000, store, fetchRelease, apkUrlPrefix: OTHER });
    expect(r).toBeNull();
    expect(fetchRelease).not.toHaveBeenCalled();
  });

  it('fetches the given url', async () => {
    const fetchFn = jest.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => otherRelease }));
    await expect(fetchLatestRelease('https://example.test/latest', fetchFn as unknown as typeof fetch)).resolves.toEqual(otherRelease);
    expect(fetchFn.mock.calls[0][0]).toBe('https://example.test/latest');
  });

  it('reports a private repo (HTTP 404) as an error, not as "no update"', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(fetchLatestRelease('https://example.test/latest', fetchFn as unknown as typeof fetch)).rejects.toThrow('404');
  });
});
