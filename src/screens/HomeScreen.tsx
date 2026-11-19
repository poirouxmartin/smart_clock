import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, AppState, Platform, PermissionsAndroid, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useI18n } from '@/modules/i18n';
import { UpdateBanner } from '@/components/UpdateBanner';
import { shouldPromptFullScreen } from '@/modules/alarm/ringUi';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { NightRepository } from '@/modules/night/NightRepository';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { AutoStatus, NightStatus, PermissionStatus, WakeLogEntry, WakeOptions, WakeSound } from '../../modules/smart-alarm';
import { ALL_DAYS, DAY_KEYS, describeNextTarget, formatMinuteOfDay, isDayOn, toggleDay } from '@/modules/night/autoConfig';
import { makeTypography, Spacing, Radius, useTheme, asGradient, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';

type HomeNav = NavigationProp<RootStackParamList>;

// Ask for the full-screen alarm permission at most once per app session.
let fullScreenPrompted = false;

const SETTINGS_KEY = 'night_settings';
const WINDOW_CHOICES = [10, 20, 30, 45];
const DEFAULT_SETTINGS = { targetMinutes: 7 * 60 + 30, windowMinutes: 30, auto: true, daysMask: ALL_DAYS };

type NightSettings = typeof DEFAULT_SETTINGS;

const SOUND_CHOICES: Array<{ id: WakeSound; labelKey: string }> = [
  { id: 'birds', labelKey: 'soundBirds' },
  { id: 'waves', labelKey: 'soundWaves' },
  { id: 'forest', labelKey: 'soundForest' },
  { id: 'rain', labelKey: 'soundRain' },
  { id: 'stream', labelKey: 'soundStream' },
  { id: 'storm', labelKey: 'soundStorm' },
];
const SOUND_LABEL_KEYS: Record<string, string> = Object.fromEntries(SOUND_CHOICES.map(s => [s.id, s.labelKey]));
const WAKE_REASON_KEYS: Record<string, string> = { smart: 'logReasonSmart', fallback: 'logReasonFallback', test: 'logReasonTest' };
const RAMP_CHOICES = [30, 60, 120];
const DAWN_CHOICES = [15, 30, 45];

/** Prochaine occurrence de HH:MM : aujourd'hui si encore dans le futur, sinon demain. */
function nextTargetMs(minutesOfDay: number, now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
  const [settings, setSettings] = useState<NightSettings>(DEFAULT_SETTINGS);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [status, setStatus] = useState<NightStatus | null>(null);
  const [latest, setLatest] = useState<NightSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  const [activityDenied, setActivityDenied] = useState(false);
  const [lastWake, setLastWake] = useState<WakeLogEntry | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [wake, setWake] = useState<WakeOptions>({ sound: 'birds', rampSeconds: 60, dawnEnabled: true, dawnMinutes: 30, torch: false });

  useEffect(() => {
    const update = () => setClock(formatTime(new Date()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  const requestAutoPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      if (Number(Platform.Version) >= 29) {
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        setActivityDenied(res !== PermissionsAndroid.RESULTS.GRANTED);
      }
      if (Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
    } catch (e) {
      console.error('requestAutoPermissions error:', e);
    }
  }, []);

  useEffect(() => {
    getDatabaseService()
      .getSetting<NightSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
      .then(saved => {
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        setSettings(merged);
        if (merged.auto) requestAutoPermissions();
      })
      .catch(e => console.error('Load night settings error:', e))
      .finally(() => setLoaded(true));
  }, [requestAutoPermissions]);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    (async () => {
      try {
        await SmartAlarm.configureAuto({
          enabled: settings.auto,
          hour: Math.floor(settings.targetMinutes / 60),
          minute: settings.targetMinutes % 60,
          daysMask: settings.daysMask,
          windowMinutes: settings.windowMinutes,
        });
        const st = await SmartAlarm.getAutoStatus();
        if (active) setAutoStatus(st);
      } catch (e) {
        console.error('configureAuto error:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, [loaded, settings.auto, settings.targetMinutes, settings.windowMinutes, settings.daysMask]);

  useEffect(() => {
    SmartAlarm.getWakeOptions()
      .then(setWake)
      .catch(e => console.error('getWakeOptions error:', e));
    return () => {
      SmartAlarm.stopPreview().catch(e => console.error('stopPreview error:', e));
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<NightSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      getDatabaseService()
        .setSetting(SETTINGS_KEY, next)
        .catch(e => console.error('Save night settings error:', e));
      return next;
    });
  }, []);

  const adjustTarget = (delta: number) => {
    const next = (((settings.targetMinutes + delta) % 1440) + 1440) % 1440;
    updateSettings({ targetMinutes: next });
  };

  const onToggleAuto = (value: boolean) => {
    updateSettings({ auto: value });
    if (value) requestAutoPermissions();
  };

  const updateWake = async (partial: Partial<WakeOptions>) => {
    try {
      setWake(await SmartAlarm.setWakeOptions(partial));
    } catch (e) {
      console.error('setWakeOptions error:', e);
    }
  };

  const onPreview = async () => {
    try {
      await SmartAlarm.previewSound(wake.sound);
    } catch (e) {
      console.error('previewSound error:', e);
    }
  };

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

  const onTestRing = async () => {
    try {
      await SmartAlarm.testRing(10);
      Alert.alert(tn('testRing'), tn('testScheduled'));
    } catch (e) {
      console.error('testRing error:', e);
    }
  };

  const targetMs = nextTargetMs(settings.targetMinutes);
  const windowStartMs = targetMs - settings.windowMinutes * 60000;
  const missingPerms = permissions
    ? PERM_ROWS.filter(row => permissions[row.key] === false)
    : [];
  const nightInProgress = status?.state === 'tracking';
  const autoLine = (() => {
    if (!autoStatus || autoStatus.currentTargetMs <= 0) return null;
    const next = describeNextTarget(autoStatus.currentTargetMs, Date.now());
    const day =
      next.dayOffset === 0
        ? tn('dayToday')
        : next.dayOffset === 1
          ? tn('dayTomorrow')
          : new Date(autoStatus.currentTargetMs).toLocaleDateString(currentLocale, { weekday: 'long' });
    return tn('autoLine', {
      day,
      time: next.hhmm,
      min: autoStatus.windowMinutes,
      usual: formatMinuteOfDay(autoStatus.usualBedMinute),
    });
  })();

  return (
    <LinearGradient colors={asGradient(c.background)} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <UpdateBanner />

          <View style={styles.header}>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Stats')} accessibilityLabel={t('statistics')}>
                <Ionicons name="bar-chart-outline" size={20} color={c.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')} accessibilityLabel={t('settings')}>
                <Ionicons name="settings-outline" size={20} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.greeting}>{tn(greetingKey(new Date().getHours()))}</Text>
            <Text style={styles.clock}>{clock}</Text>
            <Text style={styles.dateLine}>
              {new Date().toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.cardHeaderInline}>
                <Ionicons name="leaf-outline" size={18} color={c.primary} />
                <Text style={styles.cardTitleInline}>{tn('autoTitle')}</Text>
              </View>
              <Switch
                value={settings.auto}
                onValueChange={onToggleAuto}
                trackColor={{ false: c.bgSurface, true: c.primaryDark }}
                thumbColor={c.text}
              />
            </View>
            {settings.auto && (
              <>
                <View style={styles.chipRowFill}>
                  {DAY_KEYS.map((key, i) => {
                    const on = isDayOn(settings.daysMask, i);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, styles.chipFill, styles.dayChip, on && styles.chipActive]}
                        onPress={() => updateSettings({ daysMask: toggleDay(settings.daysMask, i) })}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextActive]}>{tn(`dayLetter${i}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {autoLine && <Text style={styles.windowLine}>{autoLine}</Text>}
                {autoStatus && autoStatus.skippedTargetMs > Date.now() && (
                  <TouchableOpacity style={styles.skipRow} onPress={onUnskip}>
                    <Text style={styles.caption}>
                      {tn('skippedLine', {
                        when: new Date(autoStatus.skippedTargetMs).toLocaleString(currentLocale, { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
                      })}
                    </Text>
                    <Text style={styles.secondaryText}>{tn('unskip')}</Text>
                  </TouchableOpacity>
                )}
                {activityDenied && <Text style={styles.hint}>{tn('autoActivityDenied')}</Text>}
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alarm-outline" size={18} color={c.primary} />
              <Text style={styles.cardTitleInline}>{tn('smartAlarm')}</Text>
            </View>

            <Text style={styles.label}>{tn('target')}</Text>
            <View style={styles.stepperRow}>
              <Stepper value={pad(Math.floor(settings.targetMinutes / 60))} onMinus={() => adjustTarget(-60)} onPlus={() => adjustTarget(60)} />
              <Text style={styles.colon}>:</Text>
              <Stepper value={pad(settings.targetMinutes % 60)} onMinus={() => adjustTarget(-5)} onPlus={() => adjustTarget(5)} />
            </View>

            <Text style={styles.label}>{tn('window')}</Text>
            <View style={styles.chipRowFill}>
              {WINDOW_CHOICES.map(min => {
                const active = settings.windowMinutes === min;
                return (
                  <TouchableOpacity
                    key={min}
                    style={[styles.chip, styles.chipFill, active && styles.chipActive]}
                    onPress={() => updateSettings({ windowMinutes: min })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tn('windowChip', { min })}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.windowLine}>
              {tn('windowLine', { from: hm(windowStartMs), to: hm(targetMs) })}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="musical-notes-outline" size={18} color={c.primary} />
              <Text style={styles.cardTitleInline}>{tn('wakeStyleTitle')}</Text>
            </View>

            <View style={styles.labelRow}>
              <Text style={[styles.label, styles.labelInRow]}>{tn('soundLabel')}</Text>
              <TouchableOpacity style={styles.inlineAction} onPress={onPreview}>
                <Ionicons name="play" size={14} color={c.primary} />
                <Text style={styles.secondaryText}>{tn('listen')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipRow}>
              {SOUND_CHOICES.map(choice => {
                const active = wake.sound === choice.id;
                return (
                  <TouchableOpacity
                    key={choice.id}
                    style={[styles.chip, styles.chipThird, active && styles.chipActive]}
                    onPress={() => updateWake({ sound: choice.id })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tn(choice.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{tn('rampLabel')}</Text>
            <View style={styles.chipRowFill}>
              {RAMP_CHOICES.map(s => {
                const active = wake.rampSeconds === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, styles.chipFill, active && styles.chipActive]}
                    onPress={() => updateWake({ rampSeconds: s })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tn('secondsValue', { s })}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{tn('dawnLabel')}</Text>
              <Switch
                value={wake.dawnEnabled}
                onValueChange={v => updateWake({ dawnEnabled: v })}
                trackColor={{ false: c.bgSurface, true: c.primaryDark }}
                thumbColor={c.text}
              />
            </View>
            {wake.dawnEnabled && (
              <View style={styles.chipRowFill}>
                {DAWN_CHOICES.map(min => {
                  const active = wake.dawnMinutes === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      style={[styles.chip, styles.chipFill, active && styles.chipActive]}
                      onPress={() => updateWake({ dawnMinutes: min })}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{tn('minutesValue', { min })}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{tn('torchLabel')}</Text>
              <Switch
                value={wake.torch}
                onValueChange={v => updateWake({ torch: v })}
                trackColor={{ false: c.bgSurface, true: c.primaryDark }}
                thumbColor={c.text}
              />
            </View>
            <Text style={styles.caption}>{tn('torchCaption')}</Text>
          </View>

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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tn('lastNight')}</Text>
            {latest ? (
              <>
                <Text style={styles.lastDate}>{new Date(latest.startedAtMs).toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('NightSummary', { sessionId: latest.sessionId })}>
                  <Text style={styles.secondaryText}>{tn('viewSummary')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.muted}>{tn('noNightYet')}</Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
              <Text style={styles.cardTitleInline}>{tn('lastWakeTitle')}</Text>
            </View>
            {lastWake ? (
              <>
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
              </>
            ) : (
              <Text style={styles.muted}>{tn('lastWakeNone')}</Text>
            )}
            <Text style={styles.diagVersion}>{lv(tn('appVersionLabel'), appVersion || lastWake?.appVersion || '?')}</Text>
          </View>

          <TouchableOpacity style={styles.testLink} onPress={onTestRing}>
            <Text style={styles.testLinkText}>{tn('testRing')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepButton} onPress={onMinus}>
        <Ionicons name="remove" size={20} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepButton} onPress={onPlus}>
        <Ionicons name="add" size={20} color={c.text} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl, marginTop: Spacing.md },
  greeting: { ...T.label, color: c.primaryLight, marginBottom: Spacing.xs },
  dateLine: { ...T.body, color: c.textMuted, textTransform: 'capitalize', marginTop: Spacing.xs },
  clock: { ...T.clock, fontSize: 56, textAlign: 'center' },

  card: { backgroundColor: c.bgCard + 'e6', borderRadius: 24, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: c.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardHeaderInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  cardTitleInline: { ...T.label, color: c.text },
  diagLine: { ...T.bodySmall, marginTop: Spacing.xs },
  diagError: { ...T.bodySmall, color: c.danger, marginTop: Spacing.xs },
  diagVersion: { ...T.caption, marginTop: Spacing.md },
  cardTitle: { ...T.label, color: c.text, marginBottom: Spacing.sm },
  label: { ...T.caption, marginTop: Spacing.md, marginBottom: Spacing.xs },
  muted: { ...T.bodySmall, color: c.textMuted },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 40, fontWeight: '300', color: c.text, minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  colon: { fontSize: 36, fontWeight: '300', color: c.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: c.borderLight },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { ...T.bodySmall, color: c.textSecondary },
  chipTextActive: { color: c.onPrimary, fontWeight: '600' },
  windowLine: { ...T.body, color: c.primaryLight, marginTop: Spacing.lg, textAlign: 'center', fontWeight: '500' },
  dayChip: { alignItems: 'center', paddingHorizontal: 0 },
  chipRowFill: { flexDirection: 'row', gap: Spacing.xs + 2 },
  chipFill: { flex: 1, alignItems: 'center', paddingHorizontal: 0 },
  chipThird: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', paddingHorizontal: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, marginBottom: Spacing.xs },
  labelInRow: { marginTop: 0, marginBottom: 0 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, paddingLeft: Spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.md },
  switchLabel: { ...T.bodySmall, color: c.text, flex: 1 },
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

  skipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  testLink: { alignItems: 'center', paddingVertical: Spacing.md },
  testLinkText: { ...T.bodySmall, color: c.textMuted, textDecorationLine: 'underline' },

  headerActions: { position: 'absolute', top: -Spacing.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgCard + 'cc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
});
};
