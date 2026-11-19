import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { NightRepository } from '@/modules/night/NightRepository';
import { SmartAlarm } from '../../modules/smart-alarm';
import type { NightStatus } from '../../modules/smart-alarm';
import { Typography, Spacing, Radius, useTheme, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';

type SleepNav = NavigationProp<RootStackParamList>;

const STATUS_POLL_MS = 30000;
const CLOCK_TICK_MS = 1000;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function SleepModeScreen() {
  const navigation = useNavigation<SleepNav>();
  const { t } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<NightStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const st = await SmartAlarm.getStatus();
      setStatus(st);
      if ((st.state === 'ringing' || st.state === 'done') && st.sessionId) {
        // reset rather than navigate: avoids coming back here from the summary
        navigation.reset({
          index: 1,
          routes: [{ name: 'Home' }, { name: 'NightSummary', params: { sessionId: st.sessionId } }],
        });
      }
    } catch (e) {
      console.error('SleepMode getStatus error:', e);
    }
  }, [navigation]);

  useEffect(() => {
    refreshStatus();
    const poll = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(poll);
  }, [refreshStatus]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const onStop = () => {
    Alert.alert(tn('stopConfirmTitle'), tn('stopConfirmBody'), [
      { text: tn('cancel'), style: 'cancel' },
      {
        text: tn('stopConfirmOk'),
        style: 'destructive',
        onPress: async () => {
          try {
            await SmartAlarm.cancelNight();
            await NightRepository.syncNights();
          } catch (e) {
            console.error('Stop night error:', e);
          }
          navigation.navigate('Home');
        },
      },
    ]);
  };

  const tracking = status?.state === 'tracking';
  const windowLine =
    status && status.targetAtMs
      ? tn('windowLine', {
          from: hm(status.targetAtMs - status.windowMinutes * 60000),
          to: hm(status.targetAtMs),
        })
      : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.clock}>
            {pad(now.getHours())}:{pad(now.getMinutes())}
            <Text style={styles.clockSeconds}>:{pad(now.getSeconds())}</Text>
          </Text>

          {windowLine && <Text style={styles.windowLine}>{windowLine}</Text>}

          {tracking ? (
            <Text style={styles.hint}>{tn('sleepHint')}</Text>
          ) : (
            <Text style={styles.hint}>{tn('noActiveNight')}</Text>
          )}

          {tracking && (
            <Text style={styles.status}>{tn('movementsStatus', { min: status?.epochCount ?? 0 })}</Text>
          )}
        </View>

        {tracking && (
          <TouchableOpacity style={styles.stopButton} onPress={onStop}>
            <Ionicons name="stop-circle-outline" size={20} color={c.danger} />
            <Text style={styles.stopText}>{tn('stopNight')}</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  clock: { fontSize: 96, fontWeight: '200', color: c.textSecondary, fontVariant: ['tabular-nums'], letterSpacing: -2 },
  clockSeconds: { fontSize: 36, color: c.textDim },
  windowLine: { ...Typography.body, color: c.primaryLight, marginTop: Spacing.lg, textAlign: 'center' },
  hint: { ...Typography.bodySmall, color: c.textMuted, textAlign: 'center', marginTop: Spacing.xxxl, lineHeight: 22 },
  status: { ...Typography.caption, color: c.textDim, marginTop: Spacing.lg },

  stopButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, margin: Spacing.xl, paddingVertical: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.danger + '60', backgroundColor: '#140707' },
  stopText: { ...Typography.bodySmall, color: c.danger, fontWeight: '600' },
});
