import React, { useEffect, useMemo, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { checkForUpdate, fetchLatestRelease, type AvailableUpdate, type UpdateStore } from '@/modules/update/appUpdate';
import { isUpdateDismissed, parseDismissal, type UpdateDismissal } from '@/modules/update/updateDismissal';
import { getVersionInfo, downloadAndInstallUpdate, type UpdateInstallResult } from '../../modules/smart-alarm';
import { makeTypography, Spacing, Radius, useTheme, type Palette } from '@/theme';
import { updateBannerColors } from './updateBannerColors';

const LAST_CHECK_KEY = 'update_last_check';
const CACHED_KEY = 'update_cached';
const DISMISSED_KEY = 'update_dismissed';

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

/** Update check (mount + foreground) and the persisted "later" dismissal. */
export function useAvailableUpdate() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissal, setDismissal] = useState<UpdateDismissal | null>(null);

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
        const saved = await getDatabaseService().getSetting<string>(DISMISSED_KEY, '');
        if (active) setDismissal(parseDismissal(saved));
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

  const dismissed = update ? isUpdateDismissed(dismissal, update.version, Date.now()) : false;

  const dismiss = () => {
    if (!update) return;
    const d: UpdateDismissal = { version: update.version, atMs: Date.now() };
    setDismissal(d);
    getDatabaseService()
      .setSetting(DISMISSED_KEY, JSON.stringify(d))
      .catch(e => console.error('Save update dismissal error:', e));
  };

  return { update, dismissed, dismiss };
}

export function UpdateBanner({ state, ignoreDismiss }: { state: ReturnType<typeof useAvailableUpdate>; ignoreDismiss?: boolean }) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const b = useMemo(() => updateBannerColors(c), [c]);
  const { t } = useI18n();
  const tu = (key: string, options?: Record<string, any>) => t(key, options, 'update');

  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState('');
  const { update, dismissed, dismiss } = state;

  if (!update || (dismissed && !ignoreDismiss)) return null;

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
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.row}>
        <Ionicons name="arrow-down-circle-outline" size={22} color={b.accent} />
        <Text style={styles.title}>{tu('compactTitle', { version: update.version })}</Text>
        <TouchableOpacity style={[styles.button, downloading && styles.buttonDisabled]} onPress={onInstall} disabled={downloading} accessibilityRole="button">
          <Ionicons name="download-outline" size={16} color={b.buttonText} />
          <Text style={styles.buttonText}>{downloading ? tu('downloading') : tu('installShort')}</Text>
        </TouchableOpacity>
        {!ignoreDismiss && (
          <TouchableOpacity style={styles.close} onPress={dismiss} accessibilityLabel={tu('later')}>
            <Ionicons name="close" size={20} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {ignoreDismiss && <Text style={styles.subtitle}>{tu('subtitle')}</Text>}
      {hint !== '' && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  const b = updateBannerColors(c);
  return StyleSheet.create({
    // Compact bar with an accent border: it must not reuse primary (tested in updateBannerColors).
    card: {
      backgroundColor: b.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: b.border,
      padding: Spacing.md, marginBottom: Spacing.lg,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { ...T.bodySmall, flex: 1, fontWeight: '600', color: b.text },
    subtitle: { ...T.caption, color: c.textSecondary, marginTop: Spacing.sm },
    button: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, backgroundColor: b.buttonBackground,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...T.bodySmall, color: b.buttonText, fontWeight: '700' },
    close: { padding: Spacing.xs },
    hint: { ...T.caption, color: b.text, marginTop: Spacing.sm },
  });
};
