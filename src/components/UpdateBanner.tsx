import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import {
  checkForUpdate,
  fetchLatestRelease,
  shouldAskNotificationPermission,
  type AvailableUpdate,
  type UpdateStore,
} from '@/modules/update/appUpdate';
import {
  getVersionInfo,
  downloadAndInstallUpdate,
  scheduleUpdateCheck,
  consumeUpdateOpen,
  type UpdateInstallResult,
} from '../../modules/smart-alarm';
import { makeTypography, Spacing, Radius, useTheme, type Palette } from '@/theme';
import { updateBannerColors } from './updateBannerColors';

const LAST_CHECK_KEY = 'update_last_check';
const CACHED_KEY = 'update_cached';
const NOTIF_ASKED_KEY = 'update_notif_permission_asked';

const store: UpdateStore = {
  getLastCheck: () => getDatabaseService().getSetting<number>(LAST_CHECK_KEY, 0),
  setLastCheck: ms => getDatabaseService().setSetting(LAST_CHECK_KEY, ms),
  getCached: async () => {
    const raw = await getDatabaseService().getSetting<string>(CACHED_KEY, '');
    return raw ? (JSON.parse(raw) as AvailableUpdate) : null;
  },
  setCached: u => getDatabaseService().setSetting(CACHED_KEY, u ? JSON.stringify(u) : ''),
};

const RESULT_HINT_KEYS: Record<UpdateInstallResult, string> = {
  started: 'started',
  need_permission: 'needPermission',
  download_failed: 'downloadFailed',
  bad_apk: 'invalid',
  bad_url: 'invalid',
  not_newer: 'notNewer',
};

export function UpdateBanner() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const b = useMemo(() => updateBannerColors(c), [c]);
  const { t } = useI18n();
  const tu = (key: string, options?: Record<string, any>) => t(key, options, 'update');

  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState('');
  // "Later" hides this version only: Home stays mounted for days, a newer release must still show.
  const [dismissedVersion, setDismissedVersion] = useState('');
  // The mount effect has [] deps: read the latest translator through a ref so language changes are respected.
  const tRef = useRef(tu);
  tRef.current = tu;

  // Only uses state setters and tRef, so it is safe to call from the mount effect closure
  // (and it is declared before the early return below, so it is always initialised).
  const install = async (u: AvailableUpdate) => {
    if (downloading) return;
    setDownloading(true);
    setHint('');
    try {
      const result = await downloadAndInstallUpdate(u.url, u.version);
      setHint(tRef.current(RESULT_HINT_KEYS[result] ?? 'invalid'));
    } catch (e) {
      console.error('Update install error:', e);
      setHint(tRef.current('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  // Checked on mount and each time the app comes back to the foreground: Android keeps the app
  // in memory for days, so a mount-only check could miss a release for a long time.
  // checkForUpdate throttles the network itself.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const fromNotification = await consumeUpdateOpen().catch(() => false);
        const { versionName, releasesApiUrl, apkUrlPrefix } = await getVersionInfo();
        if (!releasesApiUrl || !apkUrlPrefix) return;
        const found = await checkForUpdate({
          installedVersion: versionName,
          now: Date.now(),
          store,
          fetchRelease: () => fetchLatestRelease(releasesApiUrl),
          apkUrlPrefix,
          force: fromNotification,
        });
        if (active) setUpdate(found);
        if (active && fromNotification && found) {
          // Opened from the update notification: offer Install / Later right away.
          const tr = tRef.current;
          Alert.alert(tr('title', { version: found.version }), tr('subtitle'), [
            { text: tr('later'), style: 'cancel', onPress: () => setDismissedVersion(found.version) },
            { text: tr('install'), onPress: () => { install(found); } },
          ]);
        }
      } catch (e) {
        console.error('Update check error:', e);
      } finally {
        running = false;
      }
    };
    scheduleUpdateCheck().catch(e => console.warn('[update] schedule failed:', String(e)));
    // The background update notification needs POST_NOTIFICATIONS: asked once here, the Home
    // permission checklist stays the way to grant it later.
    (async () => {
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        const alreadyAsked = await getDatabaseService().getSetting<boolean>(NOTIF_ASKED_KEY, false);
        if (shouldAskNotificationPermission({ sdk: Number(Platform.Version), granted, alreadyAsked })) {
          await getDatabaseService().setSetting(NOTIF_ASKED_KEY, true);
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
      } catch (e) {
        console.warn('[update] notification permission ask failed:', String(e));
      }
    })();
    run();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') run();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  if (!update || update.version === dismissedVersion) return null;

  const onInstall = () => install(update);

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.titleRow}>
        <Ionicons name="arrow-down-circle" size={32} color={b.text} />
        <View style={styles.titleText}>
          <Text style={styles.title}>{tu('title', { version: update.version })}</Text>
          <Text style={styles.subtitle}>{tu('subtitle')}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.button, downloading && styles.buttonDisabled]} onPress={onInstall} disabled={downloading} accessibilityRole="button">
        <Ionicons name="download-outline" size={20} color={b.buttonText} />
        <Text style={styles.buttonText}>{downloading ? tu('downloading') : tu('install')}</Text>
      </TouchableOpacity>
      {hint !== '' && <Text style={styles.hint}>{hint}</Text>}
      <TouchableOpacity style={styles.later} onPress={() => setDismissedVersion(update.version)}>
        <Text style={styles.laterText}>{tu('later')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  const b = updateBannerColors(c);
  return StyleSheet.create({
    // Solid primary card, not bgCard: it must stand out from the other cards (tested in updateBannerColors).
    card: {
      backgroundColor: b.background, borderRadius: 24, padding: Spacing.xxl, marginBottom: Spacing.xl,
      elevation: 6, shadowColor: c.bg, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    titleText: { flex: 1 },
    title: { ...T.body, fontSize: 18, fontWeight: '700', color: b.text },
    subtitle: { ...T.bodySmall, color: b.text, opacity: 0.85, marginTop: 2 },
    button: {
      marginTop: Spacing.lg, paddingVertical: Spacing.lg, borderRadius: Radius.full, backgroundColor: b.buttonBackground,
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...T.body, fontSize: 17, color: b.buttonText, fontWeight: '700' },
    hint: { ...T.caption, color: b.text, marginTop: Spacing.md },
    later: { alignItems: 'center', marginTop: Spacing.md, paddingVertical: Spacing.xs },
    laterText: { ...T.bodySmall, color: b.text, textDecorationLine: 'underline' },
  });
};
