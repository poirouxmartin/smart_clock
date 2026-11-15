/** Fallbacks only: the native module (AppUpdater.RELEASES_REPO) is the source of truth. */
export const RELEASES_URL = 'https://api.github.com/repos/poirouxmartin/smart_clock/releases/latest';
export const APK_URL_PREFIX = 'https://github.com/poirouxmartin/smart_clock/releases/download/';
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AvailableUpdate {
  version: string;
  url: string;
}

export interface UpdateStore {
  getLastCheck(): Promise<number>;
  setLastCheck(ms: number): Promise<void>;
  getCached(): Promise<AvailableUpdate | null>;
  setCached(u: AvailableUpdate | null): Promise<void>;
}

/** Numeric per-segment comparison; leading 'v' and any '-suffix' are ignored, missing segments are 0. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.trim().replace(/^v/i, '').split('-')[0].split('.').map(s => parseInt(s, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Extracts the installable update from a GitHub release payload, or null if it is not trustworthy. */
export function pickUpdate(release: unknown, apkUrlPrefix: string = APK_URL_PREFIX): AvailableUpdate | null {
  if (!release || typeof release !== 'object') return null;
  const r = release as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true) return null;
  if (typeof r.tag_name !== 'string') return null;
  const version = r.tag_name.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  if (!Array.isArray(r.assets)) return null;
  for (const asset of r.assets) {
    if (!asset || typeof asset !== 'object') continue;
    const { name, browser_download_url: url } = asset as Record<string, unknown>;
    if (typeof name === 'string' && typeof url === 'string' && name.endsWith('.apk') && url.startsWith(apkUrlPrefix)) {
      return { version, url };
    }
  }
  return null;
}

/** At most one network attempt per CHECK_INTERVAL_MS, even when it fails. Never throws. */
export async function checkForUpdate(opts: {
  installedVersion: string;
  now: number;
  store: UpdateStore;
  fetchRelease: () => Promise<unknown>;
  apkUrlPrefix?: string;
}): Promise<AvailableUpdate | null> {
  const { installedVersion, now, store, fetchRelease, apkUrlPrefix = APK_URL_PREFIX } = opts;
  try {
    const lastCheck = await store.getLastCheck();
    let candidate = await store.getCached();
    const fresh = lastCheck <= now && now - lastCheck < CHECK_INTERVAL_MS;
    if (!fresh) {
      await store.setLastCheck(now);
      try {
        candidate = pickUpdate(await fetchRelease(), apkUrlPrefix);
        await store.setCached(candidate);
      } catch (e) {
        // keep the previous cached value
        console.warn('[update] release check failed:', String(e));
      }
    }
    const offer = candidate && candidate.url.startsWith(apkUrlPrefix) && compareVersions(candidate.version, installedVersion) > 0 ? candidate : null;
    console.log('[update] installed', installedVersion, 'latest', candidate?.version ?? 'none', 'checked', fresh ? 'cached' : 'now');
    return offer;
  } catch (e) {
    console.warn('[update] check error:', String(e));
    return null;
  }
}

export async function fetchLatestRelease(url: string = RELEASES_URL, fetchFn: typeof fetch = fetch, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`GitHub releases HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
