import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, Modal } from 'react-native';
import { useI18n } from '@/modules/i18n';
import { ringOverlayMode } from '@/modules/alarm/ringUi';
import { getRingState, stopRing, snoozeRing, type RingState } from '../../modules/smart-alarm';
import { makeTypography, Spacing, useTheme, type Palette } from '@/theme';

const POLL_MS = 1500;

export function RingingOverlay() {
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, formatTime } = useI18n();
  const tr = (key: string, options?: Record<string, any>) => t(key, options, 'ring');

  const [state, setState] = useState<RingState | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      setState(await getRingState());
      setNow(Date.now());
    } catch (e) {
      console.error('getRingState error:', e);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', s => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [refresh]);

  const mode = ringOverlayMode(state, now);
  if (mode === 'none') return null;

  const onStop = async () => {
    try {
      await stopRing();
    } catch (e) {
      console.error('stopRing error:', e);
    }
    setTimeout(refresh, 300);
  };

  const onSnooze = async () => {
    try {
      await snoozeRing();
    } catch (e) {
      console.error('snoozeRing error:', e);
    }
    setTimeout(refresh, 300);
  };

  if (mode === 'snoozed') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>{tr('snoozedUntil', { time: formatTime(new Date(state!.snoozeUntilMs)) })}</Text>
        <TouchableOpacity style={styles.cardButton} onPress={onStop}>
          <Text style={styles.cardButtonText}>{tr('stopAlarm')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.full}>
        <Text style={styles.time}>{formatTime(new Date(now))}</Text>
        <Text style={styles.title}>{tr('title')}</Text>
        <TouchableOpacity style={styles.stopButton} onPress={onStop}>
          <Text style={styles.stopText}>{tr('stop')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.snoozeButton} onPress={onSnooze}>
          <Text style={styles.snoozeText}>{tr('snooze')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    full: {
      flex: 1,
      zIndex: 1000,
      elevation: 1000,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xxl,
    },
    time: { fontSize: 72, fontWeight: '300', color: c.text },
    title: { ...T.body, color: c.textSecondary, fontSize: 22, marginTop: Spacing.md, marginBottom: Spacing.xxl },
    stopButton: { alignSelf: 'stretch', height: 120, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    stopText: { color: c.onPrimary, fontSize: 32, fontWeight: 'bold' },
    snoozeButton: { alignSelf: 'stretch', height: 64, borderRadius: 28, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
    snoozeText: { color: c.text, fontSize: 20, fontWeight: '600' },
    card: {
      position: 'absolute',
      top: 48,
      left: Spacing.lg,
      right: Spacing.lg,
      zIndex: 1000,
      elevation: 1000,
      backgroundColor: c.bgCard,
      borderRadius: 24,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: c.primary + '60',
    },
    cardText: { ...T.label, color: c.text },
    cardButton: { marginTop: Spacing.md, paddingVertical: Spacing.md, borderRadius: 999, backgroundColor: c.primary, alignItems: 'center' },
    cardButtonText: { ...T.body, color: c.onPrimary, fontWeight: '600' },
  });
};
