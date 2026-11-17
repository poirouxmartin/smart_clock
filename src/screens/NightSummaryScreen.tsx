import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { NightRepository } from '@/modules/night/NightRepository';
import type { EpochState, NightSummary } from '@/modules/night/nightAnalysis';
import { NightChart } from '@/components/NightChart';
import { makeTypography, Spacing, Radius, useTheme, asGradient, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';

type SummaryRoute = RouteProp<RootStackParamList, 'NightSummary'>;
type SummaryNav = NavigationProp<RootStackParamList>;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function NightSummaryScreen() {
  const navigation = useNavigation<SummaryNav>();
  const route = useRoute<SummaryRoute>();
  const { t, currentLocale } = useI18n();
  const tn = (key: string, options?: Record<string, any>) => t(key, options, 'night');
  const { palette: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const stateColors: Record<EpochState, string> = c.hypno;
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

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

  const onDelete = () => {
    Alert.alert(tn('deleteNightTitle'), tn('deleteNightMessage'), [
      { text: tn('cancel'), style: 'cancel' },
      {
        text: tn('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await NightRepository.deleteNight(sessionId);
          } catch (e) {
            console.error('deleteNight error:', e);
          }
          goBack();
        },
      },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="arrow-back" size={22} color={c.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.title}>{tn('summaryTitle')}</Text>
      {summary && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete} accessibilityLabel={tn('deleteNightTitle')}>
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={asGradient(c.background)} style={styles.container}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {header}
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!summary) {
    return (
      <LinearGradient colors={asGradient(c.background)} style={styles.container}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
    <LinearGradient colors={asGradient(c.background)} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
            <Ionicons name="alarm-outline" size={18} color={c.accent} />
            <Text style={styles.reasonText}>{wakeReason(summary)}</Text>
          </View>

          {summary.signal !== 'ok' && (
            <View style={[styles.card, styles.warningCard]}>
              <Ionicons name="warning-outline" size={18} color={c.warning} />
              <Text style={styles.warningText}>
                {summary.signal === 'none'
                  ? tn('signalNone')
                  : summary.signal === 'nosensor'
                    ? tn('signalNoSensor')
                    : tn('signalLow')}
              </Text>
            </View>
          )}

          <View style={[styles.card, styles.cardColumn]}>
            <Text style={styles.cardTitle}>{tn('hypnogram')}</Text>
            <NightChart summary={summary} />

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: stateColors.calm }]} />
                <Text style={styles.legendText}>{tn('legendCalm')} {summary.pct.calm}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: stateColors.light }]} />
                <Text style={styles.legendText}>{tn('legendLight')} {summary.pct.light}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: stateColors.wake }]} />
                <Text style={styles.legendText}>{tn('legendWake')} {summary.pct.wake}%</Text>
              </View>
              {summary.pct.unknown > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: stateColors.unknown }]} />
                  <Text style={styles.legendText}>{tn('legendUnknown')} {summary.pct.unknown}%</Text>
                </View>
              )}
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

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.h2, flex: 1 },
  deleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: 60 },
  date: { ...T.body, color: c.textMuted, textTransform: 'capitalize', marginBottom: Spacing.lg },
  muted: { ...T.bodySmall, color: c.textMuted },

  statsCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: c.border, marginBottom: Spacing.md },
  statItem: { width: '50%', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  statLabel: { ...T.caption },
  statValue: { fontSize: 20, fontWeight: '700', color: c.text, marginTop: 2 },

  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: c.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: c.border, marginBottom: Spacing.md },
  reasonText: { ...T.bodySmall, color: c.textSecondary, flex: 1 },
  cardColumn: { flexDirection: 'column', alignItems: 'stretch' },
  warningCard: { borderColor: c.warning + '60' },
  warningText: { ...T.bodySmall, color: c.warning, flex: 1 },

  cardTitle: { ...T.label, marginBottom: Spacing.md },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, flexWrap: 'wrap', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...T.caption, color: c.textSecondary },

  disclaimer: { ...T.caption, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.xl },

  backButtonWide: { alignItems: 'center', paddingVertical: Spacing.lg, borderRadius: Radius.xl, backgroundColor: c.bgSurface },
  backButtonText: { ...T.bodySmall, color: c.text, fontWeight: '600' },
});
};
