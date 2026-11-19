import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useI18n } from '@/modules/i18n';
import { UpdateBanner, useAvailableUpdate } from '@/components/UpdateBanner';
import { shouldPromptFullScreen } from '@/modules/alarm/ringUi';
import { NightRepository } from '@/modules/night/NightRepository';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { NightStatus, PermissionStatus, WakeLogEntry, WakeOptions } from '../../modules/smart-alarm';
import { DAY_KEYS, describeNextTarget, formatMinuteOfDay, isDayOn, toggleDay } from '@/modules/night/autoConfig';
import { PRESET_MASKS, daysPreset, hm, nextTargetMs } from '@/modules/night/wakeChoices';
import { requestAutoPermissions, useNightSettings } from '@/modules/night/useNightSettings';
import { SOUND_CHOICES } from '@/screens/AlarmScreen';
import { makeTypography, Spacing, Radius, useTheme, asGradient, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';

type HomeNav = NavigationProp<RootStackParamList>;

// Ask for the full-screen alarm permission at most once per app session.
let fullScreenPrompted = false;

const SOUND_LABEL_KEYS: Record<string, string> = Object.fromEntries(SOUND_CHOICES.map(s => [s.id, s.labelKey]));
const WAKE_REASON_KEYS: Record<string, string> = { smart: 'logReasonSmart', fallback: 'logReasonFallback', test: 'logReasonTest' };

type PermKey = keyof PermissionStatus;

const PERM_ROWS: Array<{ key: PermKey; labelKey: string; required: boolean }> = [
  { key: 'exactAlarm', labelKey: 'permExact', required: true },
  { key: 'fullScreenIntent', labelKey: 'permFullScreen', required: true },
  { key: 'notifications', labelKey: 'permNotifications', required: true },
  { key: 'ignoringBatteryOptimizations', labelKey: 'permBattery', required: false },
];

function greetingKey(hour: number): string {
  if (hour < 5 || hour >= 22) return 'greetingNight';
  if (hour < 18) return 'greetingMorning';
  return 'greetingEvening';
}

export function HomeScreen() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<HomeNav>();
  const { t, formatTime, currentLocale } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');
  /** "Label: value" in English, "Label : value" in French. */
  const lv = (label: string, value: string) => t('labelValue', { label, value });

  const [clock, setClock] = useState('');
  const upd = useAvailableUpdate();
  const { settings, loaded, autoStatus, setAutoStatus, updateSettings } = useNightSettings({ applyOnLoad: true });
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [status, setStatus] = useState<NightStatus | null>(null);
  const [latest, setLatest] = useState<NightSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [activityDenied, setActivityDenied] = useState(false);
  const [lastWake, setLastWake] = useState<WakeLogEntry | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [wake, setWake] = useState<WakeOptions>({ sound: 'birds', rampSeconds: 60, dawnEnabled: true, dawnMinutes: 30, torch: false });
  const permsAsked = useRef(false);

  useEffect(() => {
    const update = () => setClock(formatTime(new Date()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  useEffect(() => {
    if (!loaded || permsAsked.current) return;
    permsAsked.current = true;
    if (settings.auto) requestAutoPermissions().then(setActivityDenied);
  }, [loaded, settings.auto]);

  const refreshPermissions = useCallback(async (): Promise<PermissionStatus | null> => {
    try {
      const perms = await SmartAlarm.getPermissions();
      setPermissions(perms);
      return perms;
    } catch (e) {
      console.error('getPermissions error:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refreshPermissions();
    });
    return () => sub.remove();
  }, [refreshPermissions]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const perms = await refreshPermissions();
        if (active && shouldPromptFullScreen(perms, fullScreenPrompted)) {
          fullScreenPrompted = true;
          const tr = (key: string) => t(key, undefined, 'ring');
          Alert.alert(tr('fullScreenTitle'), tr('fullScreenMessage'), [
            { text: tr('later'), style: 'cancel' },
            { text: tr('allow'), onPress: () => fixPermission('fullScreenIntent') },
          ]);
        }
        try {
          const st = await SmartAlarm.getStatus();
          if (!active) return;
          setStatus(st);
          const summaries = await NightRepository.syncNights();
          if (!active) return;
          setLatest(summaries[0] ?? null);
          const log = await SmartAlarm.getWakeLog();
          if (!active) return;
          setLastWake(log[0] ?? null);
          const opts = await SmartAlarm.getWakeOptions();
          if (!active) return;
          setWake(opts);
          const version = await SmartAlarm.getAppVersion();
          if (active) setAppVersion(version);
          if (st.state === 'done' && !st.summarySeen && st.sessionId) {
            await SmartAlarm.markSummarySeen();
            navigation.navigate('NightSummary', { sessionId: st.sessionId });
          }
        } catch (e) {
          console.error('HomeScreen focus error:', e);
        }
      })();
      return () => {
        active = false;
      };
    }, [navigation, refreshPermissions])
  );

  const fixPermission = async (key: PermKey) => {
    try {
      if (key === 'exactAlarm') await SmartAlarm.openExactAlarmSettings();
      else if (key === 'fullScreenIntent') await SmartAlarm.openFullScreenIntentSettings();
      else if (key === 'notifications') await Notifications.requestPermissionsAsync();
      else await SmartAlarm.requestIgnoreBatteryOptimizations();
    } catch (e) {
      console.error('Fix permission error:', e);
    }
    await refreshPermissions();
  };

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const targetMs = nextTargetMs(settings.targetMinutes);
      const { exactAlarm } = await SmartAlarm.startNight(targetMs, settings.windowMinutes);
      if (!exactAlarm) {
        // Inexact fallback can drift by minutes in Doze: tell the user to grant the permission.
        Alert.alert(tn('permExact'), tn('exactAlarmMissing'));
      }
      navigation.navigate('SleepMode');
    } catch (e) {
      console.error('startNight error:', e);
      Alert.alert(tn('startError'), tn('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const onUnskip = async () => {
    try {
      setAutoStatus(await SmartAlarm.unskipAuto());
    } catch (e) {
      console.error('unskipAuto error:', e);
    }
  };

  const missingPerms = permissions
    ? PERM_ROWS.filter(row => permissions[row.key] === false)
    : [];
  const nightInProgress = status?.state === 'tracking';

  const hasTarget = settings.auto && !!autoStatus && autoStatus.currentTargetMs > 0;
  const heroTargetMs = hasTarget ? autoStatus!.currentTargetMs : nextTargetMs(settings.targetMinutes);
  const heroWindow = hasTarget ? autoStatus!.windowMinutes : settings.windowMinutes;
  const heroRange = `${hm(heroTargetMs - heroWindow * 60000)}–${hm(heroTargetMs)}`;
  const heroLabel = (() => {
    if (!settings.auto) return tn('wakeWindowLabel');
    if (!hasTarget) return tn('noWakeScheduled');
    const next = describeNextTarget(autoStatus!.currentTargetMs, Date.now());
    const day =
      next.dayOffset === 0
        ? tn('dayToday')
        : next.dayOffset === 1
          ? tn('dayTomorrow')
          : new Date(autoStatus!.currentTargetMs).toLocaleDateString(currentLocale, { weekday: 'long' });
    return tn('nextWakeLabel', { day });
  })();
  const soundChoice = SOUND_CHOICES.find(s => s.id === wake.sound) ?? SOUND_CHOICES[0];
  const preset = daysPreset(settings.daysMask);

  return (
    <LinearGradient colors={asGradient(c.background)} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Stats')} accessibilityLabel={t('statistics')}>
                <Ionicons name="bar-chart-outline" size={20} color={c.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.navigate('Settings')}
                accessibilityLabel={upd.update ? `${t('settings')}, ${t('available', undefined, 'update')}` : t('settings')}
              >
                <Ionicons name="settings-outline" size={20} color={c.textSecondary} />
                {upd.update && <View style={styles.updateDot} />}
              </TouchableOpacity>
            </View>
            <Text style={styles.greeting}>{tn(greetingKey(new Date().getHours()))}</Text>
            <Text style={styles.clock}>{clock}</Text>
            <Text style={styles.dateLine}>
              {new Date().toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          <UpdateBanner state={upd} />

          <TouchableOpacity style={styles.hero} onPress={() => navigation.navigate('Alarm')} activeOpacity={0.8}>
            <View style={styles.heroLabelRow}>
              <Ionicons name="sunny-outline" size={16} color={c.primaryLight} />
              <Text style={styles.heroLabel}>{heroLabel}</Text>
            </View>
            <Text style={[styles.heroRange, settings.auto && !hasTarget && styles.heroRangeMuted]}>{heroRange}</Text>
            {hasTarget && autoStatus && <Text style={styles.heroCaption}>{tn('usualLine', { usual: formatMinuteOfDay(autoStatus.usualBedMinute) })}</Text>}
            {!settings.auto && <Text style={styles.heroCaption}>{tn('manualHint')}</Text>}
            <View style={styles.pillRow}>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name={soundChoice.icon} size={16} color={c.textSecondary} />
                <Text style={styles.infoChipText}>{tn(soundChoice.labelKey)}</Text>
              </View>
              {wake.dawnEnabled && (
                <View style={styles.infoChip}>
                  <Ionicons name="sunny-outline" size={16} color={c.textSecondary} />
                  <Text style={styles.infoChipText}>{tn('dawnChip', { min: wake.dawnMinutes })}</Text>
                </View>
              )}
              <View style={styles.infoChip}>
                <Ionicons name="create-outline" size={16} color={c.primaryLight} />
                <Text style={[styles.infoChipText, { color: c.primaryLight }]}>{tn('editAlarm')}</Text>
              </View>
            </View>
            {settings.auto && autoStatus && autoStatus.skippedTargetMs > Date.now() && (
              <TouchableOpacity style={styles.skipRow} onPress={onUnskip}>
                <Text style={styles.caption}>
                  {tn('skippedLine', {
                    when: new Date(autoStatus.skippedTargetMs).toLocaleString(currentLocale, { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
                  })}
                </Text>
                <Text style={styles.secondaryText}>{tn('unskip')}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {settings.auto && (
            <View style={styles.daysBlock}>
              <View style={styles.daysRow}>
                {DAY_KEYS.map((key, i) => {
                  const on = isDayOn(settings.daysMask, i);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.dayButton, on && styles.dayButtonOn]}
                      onPress={() => updateSettings({ daysMask: toggleDay(settings.daysMask, i) })}
                    >
                      <Text style={[styles.dayText, on && styles.dayTextOn]}>{tn(`dayLetter${i}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.presetRow}>
                {(['weekdays', 'everyDay'] as const).map(key => {
                  const active = preset === key;
                  return (
                    <TouchableOpacity key={key} style={[styles.presetPill, active && styles.presetPillActive]} onPress={() => updateSettings({ daysMask: PRESET_MASKS[key] })}>
                      <Text style={[styles.presetText, active && styles.presetTextActive]}>{tn(key)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {activityDenied && <Text style={styles.hint}>{tn('autoActivityDenied')}</Text>}
            </View>
          )}

          {missingPerms.length > 0 && (
            <View style={[styles.card, styles.permCard]}>
              <Text style={styles.cardTitle}>{tn('permissionsTitle')}</Text>
              {missingPerms.map(row => (
                <View key={row.key} style={styles.permRow}>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>{tn(row.labelKey)}</Text>
                    <Text style={[styles.permTag, { color: row.required ? c.warning : c.textMuted }]}>
                      {row.required ? tn('required') : tn('recommended')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.fixButton} onPress={() => fixPermission(row.key)}>
                    <Text style={styles.fixButtonText}>{tn('fix')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {nightInProgress ? (
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('SleepMode')}>
              <View style={styles.primaryGradient}>
                <Ionicons name="moon" size={22} color={c.onPrimary} />
                <Text style={styles.primaryText}>{tn('resume')}</Text>
              </View>
            </TouchableOpacity>
          ) : settings.auto ? (
            <TouchableOpacity style={styles.startNowButton} onPress={onStart} disabled={busy}>
              <Ionicons name="moon-outline" size={20} color={c.primaryLight} />
              <Text style={styles.startNowText}>{tn('startNow')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={onStart} disabled={busy}>
              <View style={styles.primaryGradient}>
                <Ionicons name="moon" size={22} color={c.onPrimary} />
                <Text style={styles.primaryText}>{tn('start')}</Text>
              </View>
            </TouchableOpacity>
          )}

          {latest && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{tn('lastNight')}</Text>
              <Text style={styles.lastDate}>{new Date(latest.startedAtMs).toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('NightSummary', { sessionId: latest.sessionId })}>
                <Text style={styles.secondaryText}>{tn('viewSummary')}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </TouchableOpacity>
            </View>
          )}

          {lastWake && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
                <Text style={styles.cardTitleInline}>{tn('lastWakeTitle')}</Text>
              </View>
              <Text style={styles.diagLine}>
                {new Date(lastWake.atMs).toLocaleString(currentLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.diagLine}>
                {lv(tn('lastWakeReason'), tn(WAKE_REASON_KEYS[lastWake.reason] ?? 'logReasonTest'))}
              </Text>
              <Text style={styles.diagLine}>
                {lv(tn('lastWakeSound'), lastWake.played ? tn(SOUND_LABEL_KEYS[lastWake.played] ?? 'soundBirds') : tn('lastWakeNoSound'))}
              </Text>
              <Text style={styles.diagLine}>{lv(tn('lastWakeFade'), tn('secondsValue', { s: lastWake.rampSeconds }))}</Text>
              {lastWake.error !== '' && <Text style={styles.diagError}>{lv(tn('lastWakeError'), lastWake.error)}</Text>}
              <Text style={styles.diagVersion}>{lv(tn('appVersionLabel'), appVersion || lastWake.appVersion || '?')}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: Spacing.xxl, marginTop: Spacing.md },
  greeting: { ...T.label, color: c.primaryLight, marginBottom: Spacing.xs },
  dateLine: { ...T.body, color: c.textMuted, textTransform: 'capitalize', marginTop: Spacing.xs },
  clock: { ...T.clock, fontSize: 56, textAlign: 'center' },

  card: { backgroundColor: c.bgCard + 'e6', borderRadius: 24, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: c.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitleInline: { ...T.label, color: c.text },
  diagLine: { ...T.bodySmall, marginTop: Spacing.xs },
  diagError: { ...T.bodySmall, color: c.danger, marginTop: Spacing.xs },
  diagVersion: { ...T.caption, marginTop: Spacing.md },
  cardTitle: { ...T.label, color: c.text, marginBottom: Spacing.sm },

  hero: { backgroundColor: c.bgCardAlt, borderRadius: 24, padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 1, borderColor: c.borderLight },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  heroLabel: { ...T.caption, color: c.primaryLight, textTransform: 'uppercase', letterSpacing: 1 },
  heroRange: { fontSize: 40, fontWeight: '300', color: c.text, marginTop: Spacing.sm, fontVariant: ['tabular-nums'] },
  heroRangeMuted: { color: c.textMuted },
  heroCaption: { ...T.caption, color: c.textMuted, marginTop: Spacing.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, borderWidth: 1, borderColor: c.borderLight },
  infoChipText: { ...T.bodySmall, color: c.textSecondary },

  daysBlock: { marginBottom: Spacing.lg },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.borderLight },
  dayButtonOn: { backgroundColor: c.primary, borderColor: c.primary },
  dayText: { ...T.bodySmall, color: c.textDim },
  dayTextOn: { color: c.onPrimary, fontWeight: '700' },
  presetRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  presetPill: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, borderWidth: 1, borderColor: c.borderLight },
  presetPillActive: { borderColor: c.primary },
  presetText: { ...T.bodySmall, color: c.textSecondary },
  presetTextActive: { color: c.primaryLight },

  hint: { ...T.caption, color: c.warning, marginTop: Spacing.md },
  caption: { ...T.caption, color: c.textMuted, marginTop: Spacing.sm },
  startNowButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 16, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.primary, marginBottom: Spacing.lg },
  startNowText: { ...T.body, color: c.primaryLight, fontWeight: '600' },

  permCard: { borderColor: c.warning + '60' },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  permInfo: { flex: 1 },
  permLabel: { ...T.bodySmall, color: c.text },
  permTag: { fontSize: 12, marginTop: 2 },
  fixButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: c.bgSurface },
  fixButtonText: { ...T.bodySmall, color: c.primaryLight, fontWeight: '600' },

  primaryButton: { borderRadius: Radius.xl, marginBottom: Spacing.lg, backgroundColor: c.button[0] },
  primaryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: Spacing.md },
  primaryText: { ...T.h3, color: c.onPrimary },

  lastDate: { ...T.body, color: c.text, textTransform: 'capitalize', marginTop: Spacing.xs },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  secondaryText: { ...T.bodySmall, color: c.primary, fontWeight: '600' },

  skipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },

  headerActions: { position: 'absolute', top: -Spacing.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgCard + 'cc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  updateDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
});
};
