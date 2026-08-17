import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Platform, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { getBedtimeCalculator, createBedtimeCalculator } from '@/modules/bedtime-calculator';
import { getAlarmEngine } from '@/modules/alarm-engine';
import type { RootStackParamList, SleepSession } from '@/types';

type HomeNav = React.NavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { t, tHome, tAlarm, tSleep, formatTime, formatDuration, currentLocale } = useI18n();
  
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [nextAlarm, setNextAlarm] = useState<{ label: string; windowStart: string; windowEnd: string } | null>(null);
  const [bedtime, setBedtime] = useState<{ time: string; cycles: number } | null>(null);
  const [lastNight, setLastNight] = useState<SleepSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const profileManager = getUserProfileManager();
      const profile = profileManager.getProfile();
      const bedtimeCalc = createBedtimeCalculator();
      const alarmEngine = getAlarmEngine();

      // Next alarm
      const alarms = alarmEngine.getEnabledAlarms();
      if (alarms.length > 0) {
        const next = alarmEngine.getNextWakeTime(alarms[0].id);
        if (next) {
          const date = new Date(next);
          const endDate = new Date(next + 90 * 60 * 1000);
          setNextAlarm({
            label: alarms[0].label,
            windowStart: formatTime(date),
            windowEnd: formatTime(endDate),
          });
        }
      }

      // Bedtime calculation
      if (profile) {
        const wakeTime = new Date();
        wakeTime.setHours(7, 30, 0, 0);
        if (wakeTime <= new Date()) wakeTime.setDate(wakeTime.getDate() + 1);
        
        const result = bedtimeCalc.calculate({
          targetWakeTime: wakeTime.getTime(),
          sleepCycleLength: profile.sleepCycleLength,
          desiredCycles: profile.desiredCycles,
          fallAsleepDuration: profile.fallAsleepDuration,
          chronotype: profile.chronotype,
        });
        setBedtime({
          time: formatTime(new Date(result.idealBedtime)),
          cycles: result.cycles,
        });
      }

      // Last night
      const sessions = await profileManager.getRecentSessions(1);
      if (sessions.length > 0) {
        setLastNight(sessions[0]);
      }
    } catch (e) {
      console.error('HomeScreen loadData error:', e);
    }
  }, [formatTime]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(formatTime(now));
      setDateString(now.toLocaleDateString(currentLocale, { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [formatTime, currentLocale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatSleepDuration = (ms?: number) => {
    if (!ms) return '--';
    return formatDuration(ms);
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />}
      >
        <View style={styles.header}>
          <Text style={styles.time}>{timeString}</Text>
          <Text style={styles.date}>{dateString}</Text>
        </View>

        {nextAlarm && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tAlarm('nextAlarm')}</Text>
            <Text style={styles.nextAlarm}>{nextAlarm.windowStart} - {nextAlarm.windowEnd}</Text>
            <Text style={styles.alarmSubtitle}>{tAlarm('smartWakeWindow')}</Text>
            <Text style={styles.alarmLabel}>{nextAlarm.label}</Text>
          </View>
        )}

        {bedtime && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tHome('bedtimeIndicator')}</Text>
            <Text style={styles.bedtime}>{bedtime.time}</Text>
            <Text style={styles.bedtimeSubtitle}>{tHome('forCycles', { cycles: bedtime.cycles })}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => navigation.navigate('AlarmSetup')}
          >
            <Text style={styles.buttonText}>{tHome('newAlarm')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => navigation.navigate('SleepAnalysis')}
          >
            <Text style={styles.buttonText}>{tHome('sleepAnalysis')}</Text>
          </TouchableOpacity>
        </View>

        {lastNight && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tHome('lastNight')}</Text>
            <View style={styles.sleepSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatSleepDuration(lastNight.totalSleepTime)}</Text>
                <Text style={styles.summaryLabel}>{tHome('duration')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{lastNight.sleepEfficiency ? `${lastNight.sleepEfficiency}%` : '--'}</Text>
                <Text style={styles.summaryLabel}>{tSleep('sleepEfficiency')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{lastNight.cyclesCount || '--'}</Text>
                <Text style={styles.summaryLabel}>{tHome('cycles')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{getQualityLabel(lastNight.qualityRating)}</Text>
                <Text style={styles.summaryLabel}>{tSleep('quality')}</Text>
              </View>
            </View>
            {lastNight.wakeTriggerReason && (
              <Text style={styles.wakeReason}>
                {tAlarm('triggerReason', { reason: lastNight.wakeTriggerReason })}
              </Text>
            )}
          </View>
        )}

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={() => navigation.navigate('DevTools')}
          >
            <Text style={styles.devButtonText}>🛠 {tHome('devTools')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsButtonText}>⚙️ {tCommon('settings')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scrollContent: { flex: 1, padding: 20, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 30 },
  time: { fontSize: 72, fontWeight: '300', color: '#fff', letterSpacing: -2 },
  date: { fontSize: 16, color: '#8b9cb3', textTransform: 'capitalize' },
  card: { backgroundColor: '#131a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  nextAlarm: { fontSize: 36, fontWeight: '600', color: '#fff' },
  alarmSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  alarmLabel: { fontSize: 13, color: '#0ea5e9', marginTop: 8, fontWeight: '500' },
  bedtime: { fontSize: 36, fontWeight: '600', color: '#22d3ee' },
  bedtimeSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  button: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#0ea5e9' },
  buttonSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sleepSummary: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 },
  summaryItem: { alignItems: 'center', minWidth: '40%' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 12, color: '#8b9cb3', marginTop: 2 },
  wakeReason: { fontSize: 12, color: '#64748b', marginTop: 12, textAlign: 'center' },
  devButton: { marginTop: 20, padding: 12, backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center' },
  devButtonText: { color: '#64748b', fontSize: 13 },
  settingsButton: { position: 'absolute', bottom: 30, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  settingsButtonText: { color: '#64748b', fontSize: 14 },
});