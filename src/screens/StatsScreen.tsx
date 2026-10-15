import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { DatabaseService } from '@/modules/user-profile/DatabaseService';
import { SleepSession } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme';

const { width } = Dimensions.get('window');

const HOURS_MS = 1000 * 60 * 60;

export function StatsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DatabaseService.getInstance()
      .getRecentSleepSessions(30)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const grouped = sessions.reduce<Record<string, SleepSession[]>>((acc, s) => {
    const key = new Date(s.startTime).toISOString().split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const validSessions = sessions.filter(s => s.totalSleepTime != null && s.sleepEfficiency != null);

  const avgSleepHours =
    validSessions.length > 0
      ? validSessions.reduce((a, s) => a + (s.totalSleepTime || 0), 0) / validSessions.length / HOURS_MS
      : 0;

  const avgEfficiency =
    validSessions.length > 0
      ? validSessions.reduce((a, s) => a + (s.sleepEfficiency || 0), 0) / validSessions.length
      : 0;

  const avgCycles =
    validSessions.length > 0
      ? validSessions.reduce((a, s) => a + (s.cyclesCount || 0), 0) / validSessions.length
      : 0;

  const recentDays = period === 'week' ? 7 : 28;
  const recentDates = Object.keys(grouped)
    .sort()
    .slice(-recentDays);

  const chartLabels = recentDates.map(d => {
    const date = new Date(d + 'T12:00:00');
    return period === 'week'
      ? date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
      : `S${Math.ceil(date.getDate() / 7)}`;
  });

  const chartHours = recentDates.map(d => {
    const daySessions = grouped[d].filter(s => s.totalSleepTime != null);
    if (daySessions.length === 0) return 0;
    return daySessions.reduce((a, s) => a + (s.totalSleepTime || 0), 0) / daySessions.length / HOURS_MS;
  });

  const chartQuality = recentDates.map(d => {
    const daySessions = grouped[d].filter(s => s.sleepEfficiency != null);
    if (daySessions.length === 0) return 0;
    return Math.round(daySessions.reduce((a, s) => a + (s.sleepEfficiency || 0), 0) / daySessions.length);
  });

  const recentNights = sessions.slice(0, 7).map(s => {
    const date = new Date(s.startTime);
    const hours = s.totalSleepTime != null ? s.totalSleepTime / HOURS_MS : 0;
    const efficiency = s.sleepEfficiency || 0;
    const quality = s.qualityRating;
    const qualityLabel =
      quality === 'great' ? 'Bonne' : quality === 'good' ? 'Bonne' : quality === 'ok' ? 'Moyenne' : 'Mauvaise';
    const qualityColor =
      quality === 'great' || quality === 'good'
        ? Colors.success
        : quality === 'ok'
        ? Colors.warning
        : Colors.danger;

    return {
      date,
      hours,
      efficiency,
      qualityLabel,
      qualityColor,
    };
  });

  const emptyState = !loading && sessions.length === 0;

  return (
    <LinearGradient colors={['#0a0e1a', '#0f172a']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="stats-chart" size={36} color={Colors.primary} />
            <Text style={styles.title}>Statistiques</Text>
          </View>

          {emptyState ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="moon-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Pas encore de données de sommeil</Text>
              <Text style={styles.emptySubtitle}>Commence à dormir pour voir tes statistiques</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('SleepMode' as never)}
              >
                <Ionicons name="bed-outline" size={20} color={Colors.text} />
                <Text style={styles.emptyButtonText}>Commencer une session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.periodToggle}>
                <TouchableOpacity
                  style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
                  onPress={() => setPeriod('week')}
                >
                  <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>Semaine</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
                  onPress={() => setPeriod('month')}
                >
                  <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>Mois</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <LinearGradient colors={[Colors.primary + '20', Colors.primary + '05']} style={styles.statCardInner}>
                    <Ionicons name="moon-outline" size={24} color={Colors.primary} />
                    <Text style={styles.statValue}>{avgSleepHours.toFixed(1)}h</Text>
                    <Text style={styles.statLabel}>Moy. sommeil</Text>
                  </LinearGradient>
                </View>
                <View style={styles.statCard}>
                  <LinearGradient colors={[Colors.success + '20', Colors.success + '05']} style={styles.statCardInner}>
                    <Ionicons name="star-outline" size={24} color={Colors.success} />
                    <Text style={styles.statValue}>{Math.round(avgEfficiency)}%</Text>
                    <Text style={styles.statLabel}>Moy. qualité</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <LinearGradient colors={[Colors.accent + '20', Colors.accent + '05']} style={styles.statCardInner}>
                    <Ionicons name="bed-outline" size={24} color={Colors.accent} />
                    <Text style={styles.statValue}>{avgCycles.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Cycles / nuit</Text>
                  </LinearGradient>
                </View>
                <View style={styles.statCard}>
                  <LinearGradient colors={[Colors.warning + '20', Colors.warning + '05']} style={styles.statCardInner}>
                    <Ionicons name="time-outline" size={24} color={Colors.warning} />
                    <Text style={styles.statValue}>{validSessions.length}</Text>
                    <Text style={styles.statLabel}>Nuits enregistrées</Text>
                  </LinearGradient>
                </View>
              </View>

              {chartHours.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Durée du sommeil</Text>
                  <View style={styles.chartCard}>
                    <LineChart
                      data={{
                        labels: chartLabels,
                        datasets: [{ data: chartHours }],
                      }}
                      width={width - Spacing.xxl * 2 - Spacing.lg * 2}
                      height={200}
                      chartConfig={{
                        backgroundColor: Colors.bgCard,
                        backgroundGradientFrom: Colors.bgCard,
                        backgroundGradientTo: Colors.bgCard,
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
                        labelColor: () => Colors.textMuted,
                        propsForDots: { r: '5', strokeWidth: '2', stroke: Colors.primary },
                        propsForBackgroundLines: { stroke: Colors.border },
                      }}
                      bezier
                      style={styles.chart}
                    />
                  </View>
                </>
              )}

              {chartQuality.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Qualité du sommeil</Text>
                  <View style={styles.chartCard}>
                    <BarChart
                      data={{
                        labels: chartLabels,
                        datasets: [{ data: chartQuality }],
                      }}
                      width={width - Spacing.xxl * 2 - Spacing.lg * 2}
                      height={200}
                      chartConfig={{
                        backgroundColor: Colors.bgCard,
                        backgroundGradientFrom: Colors.bgCard,
                        backgroundGradientTo: Colors.bgCard,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                        labelColor: () => Colors.textMuted,
                        propsForBackgroundLines: { stroke: Colors.border },
                        barPercentage: 0.6,
                      }}
                      style={styles.chart}
                    />
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Dernières nuits</Text>
              {recentNights.map((night, i) => {
                const dayName = night.date.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <View key={i} style={styles.nightRow}>
                    <View style={styles.nightDate}>
                      <Text style={styles.nightDay}>{dayName}</Text>
                    </View>
                    <View style={styles.nightData}>
                      <Ionicons name="moon-outline" size={16} color={Colors.primary} />
                      <Text style={styles.nightHours}>{night.hours.toFixed(1)}h</Text>
                    </View>
                    <View style={[styles.nightBadge, { backgroundColor: night.qualityColor + '20' }]}>
                      <Text style={[styles.nightBadgeText, { color: night.qualityColor }]}>{night.qualityLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xxl },
  title: { ...Typography.h1 },

  periodToggle: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.full, padding: 3, marginBottom: Spacing.xxl },
  periodButton: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.full },
  periodButtonActive: { backgroundColor: Colors.primary },
  periodText: { ...Typography.bodySmall, color: Colors.textMuted, fontWeight: '600' },
  periodTextActive: { color: Colors.text },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statCard: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  statCardInner: { padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
  statValue: { fontSize: 28, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  statLabel: { ...Typography.caption, marginTop: Spacing.xs },

  sectionTitle: { ...Typography.label, marginBottom: Spacing.md, marginTop: Spacing.lg },

  chartCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  chart: { borderRadius: Radius.md },

  nightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  nightDate: { width: 100 },
  nightDay: { ...Typography.bodySmall, color: Colors.textMuted },
  nightData: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nightHours: { ...Typography.body, fontWeight: '600' },
  nightBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  nightBadgeText: { fontSize: 12, fontWeight: '600' },

  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  emptyTitle: { ...Typography.h2, marginTop: Spacing.xl, textAlign: 'center' },
  emptySubtitle: { ...Typography.body, marginTop: Spacing.sm, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full, marginTop: Spacing.xxl },
  emptyButtonText: { ...Typography.body, color: Colors.text, fontWeight: '600' },
});
