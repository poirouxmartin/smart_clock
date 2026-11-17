import React, { useEffect, useMemo, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { checkForUpdate, fetchLatestRelease, type AvailableUpdate, type UpdateStore } from '@/modules/update/appUpdate';
import { getVersionInfo, downloadAndInstallUpdate, type UpdateInstallResult } from '../../modules/smart-alarm';
import { makeTypography, Spacing, Radius, useTheme, type Palette } from '@/theme';

const LAST_CHECK_KEY = 'update_last_check';
const CACHED_KEY = 'update_cached';

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
  const { t } = useI18n();
  const tu = (key: string, options?: Record<string, any>) => t(key, options, 'update');

  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState('');
  const [dismissed, setDismissed] = useState(false);

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
        const { versionName, releasesApiUrl, apkUrlPrefix } = await getVersionInfo();
        if (!releasesApiUrl || !apkUrlPrefix) return;
        const found = await checkForUpdate({
          installedVersion: versionName,
          now: Date.now(),
          store,
          fetchRelease: () => fetchLatestRelease(releasesApiUrl),
          apkUrlPrefix,
        });
        if (active) setUpdate(found);
      } catch (e) {
        console.error('Update check error:', e);
      } finally {
        running = false;
      }
    };
    run();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') run();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  if (!update || dismissed) return null;

  const onInstall = async () => {
    if (downloading) return;
    setDownloading(true);
    setHint('');
    try {
      const result = await downloadAndInstallUpdate(update.url, update.version);
      setHint(tu(RESULT_HINT_KEYS[result] ?? 'invalid'));
    } catch (e) {
      console.error('Update install error:', e);
      setHint(tu('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="arrow-down-circle-outline" size={18} color={c.primary} />
        <Text style={styles.title}>{tu('title', { version: update.version })}</Text>
      </View>
      <TouchableOpacity style={[styles.button, downloading && styles.buttonDisabled]} onPress={onInstall} disabled={downloading}>
        <Text style={styles.buttonText}>{downloading ? tu('downloading') : tu('install')}</Text>
      </TouchableOpacity>
      {hint !== '' && <Text style={styles.hint}>{hint}</Text>}
      <TouchableOpacity style={styles.later} onPress={() => setDismissed(true)}>
        <Text style={styles.laterText}>{tu('later')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    card: { backgroundColor: c.bgCard + 'e6', borderRadius: 24, padding: Spacing.xxl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: c.primary + '60' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { ...T.label, color: c.text, flex: 1 },
    button: { marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.full, backgroundColor: c.primary, alignItems: 'center' },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...T.body, color: c.onPrimary, fontWeight: '600' },
    hint: { ...T.caption, color: c.textSecondary, marginTop: Spacing.md },
    later: { alignItems: 'center', marginTop: Spacing.md },
    laterText: { ...T.bodySmall, color: c.textMuted },
  });
};
