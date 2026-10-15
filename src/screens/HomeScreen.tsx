import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useI18n } from '@/modules/i18n';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { NightRepository } from '@/modules/night/NightRepository';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { NightStatus, PermissionStatus } from '../../modules/smart-alarm';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { RootStackParamList } from '@/types';

type HomeNav = NavigationProp<RootStackParamList>;

const SETTINGS_KEY = 'night_settings';
const WINDOW_CHOICES = [10, 20, 30, 45];
const DEFAULT_SETTINGS = { targetMinutes: 7 * 60 + 30, windowMinutes: 30 };

type NightSettings = typeof DEFAULT_SETTINGS;

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

  useEffect(() => {
    const update = () => setClock(formatTime(new Date()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  useEffect(() => {
    getDatabaseService()
      .getSetting<NightSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
      .then(saved => setSettings({ ...DEFAULT_SETTINGS, ...saved }))
      .catch(e => console.error('Load night settings error:', e));
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

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissions(await SmartAlarm.getPermissions());
    } catch (e) {
      console.error('getPermissions error:', e);
    }
  }, []);

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

  return (
    <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.clock}>{clock}</Text>
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
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('Stats')}>
            <Ionicons name="bar-chart" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
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

  bottomBar: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32 },
  bottomButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
});
