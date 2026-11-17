import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { NightRepository } from '@/modules/night/NightRepository';
import type { NightSummary } from '@/modules/night/nightAnalysis';
import { Screen } from '@/components/Screen';
import { makeTypography, Spacing, Radius, useTheme, useThemedStyles, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';

type StatsNav = NavigationProp<RootStackParamList>;
type IconName = keyof typeof Ionicons.glyphMap;

const RECENT_LIMIT = 14;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function StatCard({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statCard}>
      <LinearGradient colors={[color + '20', color + '05']} style={styles.statCardInner}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

export function StatsScreen() {
  const navigation = useNavigation<StatsNav>();
  const { t, currentLocale } = useI18n();
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');

  const [nights, setNights] = useState<NightSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    NightRepository.syncNights()
      .then(list => {
        if (active) setNights(list);
      })
      .catch(e => console.error('StatsScreen load error:', e))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const smart = nights.filter(n => n.wakeReason === 'smart');
    return {
      avgAsleepMin: avg(nights.map(n => n.asleepMin)),
      avgInBedMin: avg(nights.map(n => n.durationMin)),
      smartCount: smart.length,
      targetCount: nights.filter(n => n.wakeReason === 'fallback').length,
      avgSavedMin: avg(smart.map(n => n.minutesBeforeTarget)),
    };
  }, [nights]);

  const dur = (min: number) => {
    const total = Math.round(min);
    return tn('durationFormat', { h: Math.floor(total / 60), m: total % 60 });
  };

  const reasonIcon = (s: NightSummary): IconName => {
    switch (s.wakeReason) {
      case 'smart':
        return 'flash-outline';
      case 'fallback':
        return 'time-outline';
      case 'test':
        return 'flask-outline';
      default:
        return 'close-circle-outline';
    }
  };

  const empty = !loading && nights.length === 0;

  return (
    <Screen title={tn('statsTitle')} icon="stats-chart">
      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={styles.loader} />
      ) : empty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="moon-outline" size={64} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{tn('statsEmptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{tn('statsEmptySubtitle')}</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('SleepMode')}>
            <Ionicons name="bed-outline" size={20} color={c.text} />
            <Text style={styles.emptyButtonText}>{tn('start')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard icon="calendar-outline" color={c.warning} value={String(nights.length)} label={tn('statsNightsCount')} />
            <StatCard icon="moon-outline" color={c.primary} value={dur(stats.avgAsleepMin)} label={tn('statsAvgAsleep')} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="bed-outline" color={c.accent} value={dur(stats.avgInBedMin)} label={tn('statsAvgInBed')} />
            <StatCard
              icon="hourglass-outline"
              color={c.success}
              value={tn('minutesValue', { min: Math.round(stats.avgSavedMin) })}
              label={tn('statsAvgSaved')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="flash-outline" color={c.primary} value={String(stats.smartCount)} label={tn('smartAlarm')} />
            <StatCard icon="time-outline" color={c.textSecondary} value={String(stats.targetCount)} label={tn('target')} />
          </View>

          <Text style={styles.sectionTitle}>{tn('statsLastNights')}</Text>
          {nights.slice(0, RECENT_LIMIT).map(s => (
            <TouchableOpacity
              key={s.sessionId}
              style={styles.nightRow}
              onPress={() => navigation.navigate('NightSummary', { sessionId: s.sessionId })}
            >
              <View style={styles.nightDate}>
                <Text style={styles.nightDay}>
                  {new Date(s.startedAtMs).toLocaleDateString(currentLocale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <View style={styles.nightData}>
                <Ionicons name="moon-outline" size={16} color={c.primary} />
                <Text style={styles.nightHours}>{dur(s.asleepMin)}</Text>
              </View>
              <Text style={styles.nightWake}>{s.wakeAtMs ? hm(s.wakeAtMs) : '--'}</Text>
              <Ionicons name={reasonIcon(s)} size={18} color={c.textSecondary} />
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </TouchableOpacity>
          ))}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
  loader: { marginTop: Spacing.xxxl },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  statCardInner: { padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: Radius.lg },
  statValue: { fontSize: 24, fontWeight: '700', color: c.text, marginTop: Spacing.sm },
  statLabel: { ...T.caption, marginTop: Spacing.xs, textAlign: 'center' },

  sectionTitle: { ...T.label, marginBottom: Spacing.md, marginTop: Spacing.lg },

  nightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  nightDate: { width: 100 },
  nightDay: { ...T.bodySmall, color: c.textMuted },
  nightData: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nightHours: { ...T.body, fontWeight: '600' },
  nightWake: { ...T.bodySmall, color: c.textSecondary, width: 48 },

  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  emptyTitle: { ...T.h2, marginTop: Spacing.xl, textAlign: 'center' },
  emptySubtitle: { ...T.body, marginTop: Spacing.sm, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: c.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full, marginTop: Spacing.xxl },
  emptyButtonText: { ...T.body, color: c.text, fontWeight: '600' },
  });
};
