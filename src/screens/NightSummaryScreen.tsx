import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { NightRepository } from '@/modules/night/NightRepository';
import type { EpochState, NightSummary } from '@/modules/night/nightAnalysis';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { RootStackParamList } from '@/types';

type SummaryRoute = RouteProp<RootStackParamList, 'NightSummary'>;
type SummaryNav = NavigationProp<RootStackParamList>;

const MAX_BARS = 120;

const STATE_COLORS: Record<EpochState, string> = {
  calm: '#1e3a8a',
  light: '#38bdf8',
  wake: '#f59e0b',
};

const STATE_HEIGHTS: Record<EpochState, number> = {
  calm: 64,
  light: 36,
  wake: 14,
};

const SEVERITY: Record<EpochState, number> = { calm: 0, light: 1, wake: 2 };

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Regroupe les époques en au plus MAX_BARS barres (la plus « éveillée » du groupe l'emporte). */
function bucketStates(states: EpochState[], maxBars: number): EpochState[] {
  if (states.length <= maxBars) return states;
  const size = Math.ceil(states.length / maxBars);
  const out: EpochState[] = [];
  for (let i = 0; i < states.length; i += size) {
    let worst: EpochState = 'calm';
    const end = Math.min(i + size, states.length);
    for (let j = i; j < end; j++) {
      if (SEVERITY[states[j]] > SEVERITY[worst]) worst = states[j];
    }
    out.push(worst);
  }
  return out;
}

export function NightSummaryScreen() {
  const navigation = useNavigation<SummaryNav>();
  const route = useRoute<SummaryRoute>();
  const { t, currentLocale } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');
  const sessionId = route.params.sessionId;

  const [summary, setSummary] = useState<NightSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await NightRepository.loadNightSummary(sessionId);
        if (active) setSummary(s);
      } catch (e) {
        console.error('NightSummary load error:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const bars = useMemo(() => (summary ? bucketStates(summary.states, MAX_BARS) : []), [summary]);

  const dur = (min: number) => tn('durationFormat', { h: Math.floor(min / 60), m: min % 60 });

  const wakeReason = (s: NightSummary): string => {
    if (!s.wakeAtMs) return tn('wakeNone');
    switch (s.wakeReason) {
      case 'smart':
        return tn('wakeSmart', { min: s.minutesBeforeTarget });
      case 'fallback':
        return tn('wakeFallback');
      case 'test':
        return tn('wakeTest');
      default:
        return tn('wakeInterrupted');
    }
  };

  const goBack = () => navigation.navigate('Home');

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.title}>{tn('summaryTitle')}</Text>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          {header}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!summary) {
    return (
      <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          {header}
          <View style={styles.center}>
            <Text style={styles.muted}>{tn('notFound')}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const dateLabel = new Date(summary.startedAtMs).toLocaleDateString(currentLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {header}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.date}>{dateLabel}</Text>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{tn('timeInBed')}</Text>
              <Text style={styles.statValue}>{dur(summary.durationMin)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{tn('estimatedAsleep')}</Text>
              <Text style={styles.statValue}>{dur(summary.asleepMin)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{tn('sleepOnset')}</Text>
              <Text style={styles.statValue}>{summary.sleepOnsetMs ? hm(summary.sleepOnsetMs) : '--'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{tn('wakeTime')}</Text>
              <Text style={styles.statValue}>{summary.wakeAtMs ? hm(summary.wakeAtMs) : '--'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Ionicons name="alarm-outline" size={18} color={Colors.accent} />
            <Text style={styles.reasonText}>{wakeReason(summary)}</Text>
          </View>

          {summary.signal !== 'ok' && (
            <View style={[styles.card, styles.warningCard]}>
              <Ionicons name="warning-outline" size={18} color={Colors.warning} />
              <Text style={styles.warningText}>
                {summary.signal === 'none' ? tn('signalNone') : tn('signalLow')}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tn('hypnogram')}</Text>
            <View style={styles.hypnoRow}>
              {bars.map((st, i) => (
                <View
                  key={i}
                  style={[styles.bar, { height: STATE_HEIGHTS[st], backgroundColor: STATE_COLORS[st] }]}
                />
              ))}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATE_COLORS.calm }]} />
                <Text style={styles.legendText}>{tn('legendCalm')} {summary.pct.calm}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATE_COLORS.light }]} />
                <Text style={styles.legendText}>{tn('legendLight')} {summary.pct.light}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATE_COLORS.wake }]} />
                <Text style={styles.legendText}>{tn('legendWake')} {summary.pct.wake}%</Text>
              </View>
            </View>
          </View>

          <Text style={styles.disclaimer}>{tn('disclaimer')}</Text>

          <TouchableOpacity style={styles.backButtonWide} onPress={goBack}>
            <Text style={styles.backButtonText}>{tn('back')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h2 },
  scrollContent: { padding: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: 60 },
  date: { ...Typography.body, color: Colors.textMuted, textTransform: 'capitalize', marginBottom: Spacing.lg },
  muted: { ...Typography.bodySmall, color: Colors.textMuted },

  statsCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  statItem: { width: '50%', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  statLabel: { ...Typography.caption },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 2 },

  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  reasonText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  warningCard: { borderColor: Colors.warning + '60' },
  warningText: { ...Typography.bodySmall, color: Colors.warning, flex: 1 },

  cardTitle: { ...Typography.label, marginBottom: Spacing.md },
  hypnoRow: { flexDirection: 'row', alignItems: 'flex-end', height: 70 },
  bar: { flex: 1, borderRadius: 1, marginHorizontal: 0.2 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, flexWrap: 'wrap', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...Typography.caption, color: Colors.textSecondary },

  disclaimer: { ...Typography.caption, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.xl },

  backButtonWide: { alignItems: 'center', paddingVertical: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.bgSurface },
  backButtonText: { ...Typography.bodySmall, color: Colors.text, fontWeight: '600' },
});
