import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { formatDuration } from '@/modules/i18n';
import type { RootStackParamList, SleepSession } from '@/types';

type SleepAnalysisNav = React.NavigationProp<RootStackParamList, 'SleepAnalysis'>;

export function SleepAnalysisScreen() {
  const navigation = useNavigation<SleepAnalysisNav>();
  const { t, tSleep, tHome, tCommon, formatTime, formatDuration: fmtDuration } = useI18n();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const profileManager = getUserProfileManager();
      const [sessionData, trendData, statsData] = await Promise.all([
        profileManager.getRecentSessions(30),
        profileManager.getTrends(30),
        profileManager.getWeeklyStats(),
      ]);
      setSessions(sessionData);
      setTrends(trendData);
      setWeeklyStats(statsData);
    } catch (e) {
      console.error('SleepAnalysis loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getQualityLabel = (rating?: SleepSession['qualityRating']) => {
    if (!rating) return tSleep('ok');
    const map: Record<SleepSession['qualityRating'], string> = {
      great: tSleep('great'),
      good: tSleep('good'),
      ok: tSleep('ok'),
      poor: tSleep('poor'),
    };
    return map[rating];
  };

  const getQualityColor = (rating?: SleepSession['qualityRating']) => {
    if (!rating) return '#64748b';
    const map: Record<SleepSession['qualityRating'], string> = {
      great: '#22c55e',
      good: '#16a34a',
      ok: '#f59e0b',
      poor: '#ef4444',
    };
    return map[rating];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{tSleep('title')}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weeklyStats?.avgSleepTime != null ? fmtDuration(weeklyStats.avgSleepTime) : '--'}</Text>
            <Text style={styles.statLabel}>{tSleep('avgSleepTime')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weeklyStats?.avgEfficiency != null ? `${Math.round(weeklyStats.avgEfficiency)}%` : '--'}</Text>
            <Text style={styles.statLabel}>{tSleep('sleepEfficiency')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weeklyStats?.avgCycles != null ? weeklyStats.avgCycles.toFixed(1) : '--'}</Text>
            <Text style={styles.statLabel}>{tSleep('avgCycles')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>--</Text>
            <Text style={styles.statLabel}>{tSleep('fallAsleepTime')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSleep('history')}</Text>
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{tSleep('sessions')}</Text>
              <Text style={styles.emptySubtext}>{tSleep('noLightSleep')}</Text>
            </View>
          ) : (
            sessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, selectedSession === session.id && styles.sessionCardActive]}
                onPress={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
              >
                <View style={styles.sessionMain}>
                  <View>
                    <Text style={styles.sessionDate}>{formatDate(session.startTime)}</Text>
                    <Text style={styles.sessionWake}>
                      {session.actualWakeTime ? formatTime(new Date(session.actualWakeTime)) : '--'} • {fmtDuration(session.totalSleepTime)}
                    </Text>
                  </View>
                  <View style={styles.sessionQuality}>
                    <Text style={[styles.qualityScore, { color: getQualityColor(session.qualityRating) }]}>
                      {session.sleepEfficiency ? `${session.sleepEfficiency}%` : '--'}
                    </Text>
                  </View>
                </View>
                {selectedSession === session.id && (
                  <View style={styles.sessionDetail}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tSleep('cycles')}</Text>
                      <Text style={styles.detailValue}>{session.cyclesCount || '--'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tHome('wakeWindow')}</Text>
                      <Text style={styles.detailValue}>
                        {session.targetWakeWindow ? `${formatTime(new Date(session.targetWakeWindow.start))} - ${formatTime(new Date(session.targetWakeWindow.end))}` : '--'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tAlarm('optimalWakeTime')}</Text>
                      <Text style={styles.detailValue}>
                        {session.wakeTriggerReason ? `${session.wakeTriggerReason} (${session.wakeConfidence ? Math.round(session.wakeConfidence * 100) : 0}%)` : '--'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{tSleep('rating')}</Text>
                      <Text style={styles.detailValue}>{getQualityLabel(session.qualityRating)}</Text>
                    </View>
                    {session.moodRating && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{tSleep('mood')}</Text>
                        <Text style={styles.detailValue}>{'⭐'.repeat(session.moodRating)}{'☆'.repeat(5 - session.moodRating)}</Text>
                      </View>
                    )}
                    {session.notes && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{tSleep('notes')}</Text>
                        <Text style={styles.detailValue}>{session.notes}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.rateButton} onPress={() => rateSession(session.id)}>
                      <Text style={styles.rateButtonText}>{session.qualityRating ? tCommon('edit') : tCommon('add')} {tSleep('rating')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSleep('trends')}</Text>
          <View style={styles.trendCard}>
            {trends.slice(-7).map((trend, i) => (
              <Text key={i} style={styles.trendItem}>
                <Text style={styles.trendIcon}>{formatDate(trend.date)}</Text>
                <Text>{trend.avgSleepTime != null ? fmtDuration(trend.avgSleepTime) : '--'} • {trend.avgEfficiency != null ? Math.round(trend.avgEfficiency) : '--'}% • {trend.avgCycles != null ? trend.avgCycles.toFixed(1) : '--'} cycles</Text>
              </Text>
            ))}
            {trends.length === 0 && (
              <Text style={styles.trendItem}>
                <Text style={styles.trendIcon}>📊</Text>
                <Text>{tSleep('noLightSleep')}</Text>
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { tCommon, tAlarm } = require('@/modules/i18n').createI18nService ? {} : { tCommon: (k: string) => k, tAlarm: (k: string) => k };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b9cb3', fontSize: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#131a2e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 12, color: '#8b9cb3', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#131a2e', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#8b9cb3', textAlign: 'center' },
  sessionCard: { backgroundColor: '#131a2e', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  sessionCardActive: { borderColor: '#0ea5e9' },
  sessionMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { fontSize: 16, fontWeight: '600', color: '#fff' },
  sessionWake: { fontSize: 13, color: '#8b9cb3', marginTop: 2 },
  sessionQuality: { alignItems: 'flex-end' },
  qualityScore: { fontSize: 20, fontWeight: '700' },
  sessionDetail: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: '#8b9cb3' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  rateButton: { marginTop: 12, paddingVertical: 10, backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center' },
  rateButtonText: { color: '#0ea5e9', fontSize: 14, fontWeight: '600' },
  trendCard: { backgroundColor: '#131a2e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  trendItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  trendIcon: { fontSize: 18 },
});