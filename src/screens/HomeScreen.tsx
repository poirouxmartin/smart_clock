import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, AppState, Platform, PermissionsAndroid, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useI18n } from '@/modules/i18n';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { NightRepository } from '@/modules/night/NightRepository';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { AutoStatus, NightStatus, PermissionStatus, WakeOptions, WakeSound } from '../../modules/smart-alarm';
import { ALL_DAYS, DAY_KEYS, describeNextTarget, formatMinuteOfDay, isDayOn, toggleDay } from '@/modules/night/autoConfig';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { RootStackParamList } from '@/types';

type HomeNav = NavigationProp<RootStackParamList>;

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
  { id: 'system', labelKey: 'soundSystem' },
];
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

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { t, formatTime, currentLocale } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');

  const [clock, setClock] = useState('');
  const [settings, setSettings] = useState<NightSettings>(DEFAULT_SETTINGS);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [status, setStatus] = useState<NightStatus | null>(null);
  const [latest, setLatest] = useState<NightSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  const [activityDenied, setActivityDenied] = useState(false);
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

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissions(await SmartAlarm.getPermissions());
    } catch (e) {
      console.error('getPermissions error:', e);
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
        await refreshPermissions();
        try {
          const st = await SmartAlarm.getStatus();
          if (!active) return;
          setStatus(st);
          const summaries = await NightRepository.syncNights();
          if (!active) return;
          setLatest(summaries[0] ?? null);
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
    <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.clock}>{clock}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.cardTitle}>{tn('autoTitle')}</Text>
              <Switch
                value={settings.auto}
                onValueChange={onToggleAuto}
                trackColor={{ false: Colors.bgSurface, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
            {settings.auto && (
              <>
                <View style={styles.chipRow}>
                  {DAY_KEYS.map((key, i) => {
                    const on = isDayOn(settings.daysMask, i);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, styles.dayChip, on && styles.chipActive]}
                        onPress={() => updateSettings({ daysMask: toggleDay(settings.daysMask, i) })}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextActive]}>{tn(`dayLetter${i}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {autoLine && <Text style={styles.windowLine}>{autoLine}</Text>}
                {activityDenied && <Text style={styles.hint}>{tn('autoActivityDenied')}</Text>}
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alarm-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>{tn('smartAlarm')}</Text>
            </View>

            <Text style={styles.label}>{tn('target')}</Text>
            <View style={styles.stepperRow}>
              <Stepper value={pad(Math.floor(settings.targetMinutes / 60))} onMinus={() => adjustTarget(-60)} onPlus={() => adjustTarget(60)} />
              <Text style={styles.colon}>:</Text>
              <Stepper value={pad(settings.targetMinutes % 60)} onMinus={() => adjustTarget(-5)} onPlus={() => adjustTarget(5)} />
            </View>

            <Text style={styles.label}>{tn('window')}</Text>
            <View style={styles.chipRow}>
              {WINDOW_CHOICES.map(min => {
                const active = settings.windowMinutes === min;
                return (
                  <TouchableOpacity
                    key={min}
                    style={[styles.chip, active && styles.chipActive]}
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
            <Text style={styles.cardTitle}>{tn('wakeStyleTitle')}</Text>

            <Text style={styles.label}>{tn('soundLabel')}</Text>
            <View style={styles.chipRow}>
              {SOUND_CHOICES.map(choice => {
                const active = wake.sound === choice.id;
                return (
                  <TouchableOpacity
                    key={choice.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => updateWake({ sound: choice.id })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tn(choice.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={onPreview}>
              <Ionicons name="play" size={16} color={Colors.primary} />
              <Text style={styles.secondaryText}>{tn('listen')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{tn('rampLabel')}</Text>
            <View style={styles.chipRow}>
              {RAMP_CHOICES.map(s => {
                const active = wake.rampSeconds === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
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
                trackColor={{ false: Colors.bgSurface, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
            {wake.dawnEnabled && (
              <View style={styles.chipRow}>
                {DAWN_CHOICES.map(min => {
                  const active = wake.dawnMinutes === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      style={[styles.chip, active && styles.chipActive]}
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
                trackColor={{ false: Colors.bgSurface, true: Colors.primary }}
                thumbColor="#fff"
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
                    <Text style={[styles.permTag, { color: row.required ? Colors.warning : Colors.textMuted }]}>
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
              <LinearGradient colors={['#0ea5e9', '#7c3aed']} style={styles.primaryGradient}>
                <Ionicons name="moon" size={22} color="#fff" />
                <Text style={styles.primaryText}>{tn('resume')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : settings.auto ? (
            <TouchableOpacity style={styles.startNowButton} onPress={onStart} disabled={busy}>
              <Ionicons name="moon-outline" size={20} color={Colors.primaryLight} />
              <Text style={styles.startNowText}>{tn('startNow')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={onStart} disabled={busy}>
              <LinearGradient colors={['#0ea5e9', '#7c3aed']} style={styles.primaryGradient}>
                <Ionicons name="moon" size={22} color="#fff" />
                <Text style={styles.primaryText}>{tn('start')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tn('lastNight')}</Text>
            {latest ? (
              <>
                <Text style={styles.lastDate}>{new Date(latest.startedAtMs).toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('NightSummary', { sessionId: latest.sessionId })}>
                  <Text style={styles.secondaryText}>{tn('viewSummary')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.muted}>{tn('noNightYet')}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.testLink} onPress={onTestRing}>
            <Text style={styles.testLinkText}>{tn('testRing')}</Text>
          </TouchableOpacity>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('Stats')}>
              <Ionicons name="bar-chart" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepButton} onPress={onMinus}>
        <Ionicons name="remove" size={20} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepButton} onPress={onPlus}>
        <Ionicons name="add" size={20} color={Colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  clock: { ...Typography.clock, fontSize: 56, textAlign: 'center' },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { ...Typography.label, color: Colors.text, marginBottom: Spacing.sm },
  label: { ...Typography.caption, marginTop: Spacing.md, marginBottom: Spacing.xs },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 44, fontWeight: '300', color: Colors.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  colon: { fontSize: 40, fontWeight: '300', color: Colors.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderLight },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.bodySmall, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  windowLine: { ...Typography.body, color: Colors.primaryLight, marginTop: Spacing.lg, textAlign: 'center', fontWeight: '500' },
  dayChip: { width: 40, alignItems: 'center', paddingHorizontal: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.md },
  switchLabel: { ...Typography.bodySmall, color: Colors.text, flex: 1 },
  hint: { ...Typography.caption, color: Colors.warning, marginTop: Spacing.md },
  caption: { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing.sm },
  startNowButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 16, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.primary, marginBottom: Spacing.lg },
  startNowText: { ...Typography.body, color: Colors.primaryLight, fontWeight: '600' },

  permCard: { borderColor: Colors.warning + '60' },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  permInfo: { flex: 1 },
  permLabel: { ...Typography.bodySmall, color: Colors.text },
  permTag: { fontSize: 12, marginTop: 2 },
  fixButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bgSurface },
  fixButtonText: { ...Typography.bodySmall, color: Colors.primaryLight, fontWeight: '600' },

  primaryButton: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg },
  primaryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: Spacing.md },
  primaryText: { ...Typography.h3, color: '#fff' },

  lastDate: { ...Typography.body, color: Colors.text, textTransform: 'capitalize', marginTop: Spacing.xs },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  secondaryText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },

  testLink: { alignItems: 'center', paddingVertical: Spacing.md },
  testLinkText: { ...Typography.bodySmall, color: Colors.textMuted, textDecorationLine: 'underline' },

  bottomBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, marginTop: Spacing.lg },
  bottomButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
});
