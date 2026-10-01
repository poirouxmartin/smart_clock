import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay, Easing } from 'react-native-reanimated';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { getBedtimeCalculator, createBedtimeCalculator } from '@/modules/bedtime-calculator';
import { getAlarmEngine } from '@/modules/alarm-engine';
import { AnimatedButton } from '@/components/AnimatedButton';
import { AnimatedCard } from '@/components/AnimatedCard';
import { useSlideUp, useFadeIn, useScaleIn } from '@/hooks/useAnimatedStyles';
import type { RootStackParamList, SleepSession } from '@/types';

type HomeNav = React.NavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { t, tHome, tAlarm, tSleep, tCommon, formatTime, formatDuration, currentLocale } = useI18n();
  
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [nextAlarm, setNextAlarm] = useState<{ label: string; windowStart: string; windowEnd: string } | null>(null);
  const [bedtime, setBedtime] = useState<{ time: string; cycles: number } | null>(null);
  const [lastNight, setLastNight] = useState<SleepSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Animations
  const headerAnim = useSlideUp(0, 600, 40);
  const alarmCardAnim = useSlideUp(150, 600, 30);
  const bedtimeCardAnim = useSlideUp(250, 600, 30);
  const buttonsAnim = useSlideUp(350, 600, 30);
  const lastNightAnim = useSlideUp(450, 600, 30);
  const pulseAnim = useSharedValue(1);

  const loadData = useCallback(async () => {
    try {
      const profileManager = getUserProfileManager();
      const profile = profileManager.getProfile();
      
      if (!profile?.onboardingComplete) {
        navigation.replace('Onboarding');
        return;
      }
      
      setOnboardingDone(true);
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
    pulseAnim.value = withSpring(1.05, { damping: 10 }, () => {
      pulseAnim.value = withSpring(1, { damping: 10 });
    });
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
    setMounted(true);
    headerAnim.trigger();
    alarmCardAnim.trigger();
    bedtimeCardAnim.trigger();
    buttonsAnim.trigger();
    lastNightAnim.trigger();
  }, [loadData]);

  if (!onboardingDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Animated.View style={[
            styles.loadingSpinner,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}>
            <Text style={styles.loadingText}>{tCommon('loading')}</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Clock */}
        <Animated.View style={[styles.header, headerAnim.animatedStyle]}>
          <Animated.Text style={styles.time}>{timeString}</Animated.Text>
          <Animated.Text style={styles.date}>{dateString}</Animated.Text>
        </Animated.View>

        {/* Next Alarm Card */}
        {nextAlarm && (
          <Animated.View style={[styles.card, alarmCardAnim.animatedStyle]}>
            <View style={styles.cardHeader}>
              <Animated.Text style={styles.cardTitle}>{tAlarm('nextAlarm')}</Animated.Text>
              <Animated.View style={styles.smartBadge}>
                <Animated.Text style={styles.smartBadgeText}>🧠 {tAlarm('smart')}</Animated.Text>
              </Animated.View>
            </View>
            <Animated.Text style={styles.nextAlarm}>{nextAlarm.windowStart} - {nextAlarm.windowEnd}</Animated.Text>
            <Animated.Text style={styles.alarmSubtitle}>{tAlarm('smartWakeWindow')}</Animated.Text>
            <Animated.Text style={styles.alarmLabel}>{nextAlarm.label}</Animated.Text>
          </Animated.View>
        )}

        {/* Bedtime Indicator Card */}
        {bedtime && (
          <Animated.View style={[styles.card, styles.bedtimeCard, bedtimeCardAnim.animatedStyle]}>
            <Animated.Text style={styles.cardTitle}>{tHome('bedtimeIndicator')}</Animated.Text>
            <Animated.Text style={styles.bedtime}>{bedtime.time}</Animated.Text>
            <Animated.Text style={styles.bedtimeSubtitle}>{tHome('forCycles', { cycles: bedtime.cycles })}</Animated.Text>
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View style={[styles.buttonRow, buttonsAnim.animatedStyle]}>
          <AnimatedButton
            variant="primary"
            size="lg"
            fullWidth={false}
            onPress={() => navigation.navigate('AlarmSetup')}
            icon="➕"
            iconPosition="left"
          >
            {tHome('newAlarm')}
          </AnimatedButton>
          <AnimatedButton
            variant="outline"
            size="lg"
            fullWidth={false}
            onPress={() => navigation.navigate('SleepAnalysis')}
            icon="📊"
            iconPosition="left"
          >
            {tHome('sleepAnalysis')}
          </AnimatedButton>
        </Animated.View>

        {/* Last Night Card */}
        {lastNight && (
          <Animated.View style={[styles.card, lastNightAnim.animatedStyle]}>
            <View style={styles.cardHeader}>
              <Animated.Text style={styles.cardTitle}>{tHome('lastNight')}</Animated.Text>
              <Animated.Text style={[styles.qualityBadge, { backgroundColor: getQualityColor(lastNight.qualityRating) }]}>
                {getQualityLabel(lastNight.qualityRating)}
              </Animated.Text>
            </View>
            
            <View style={styles.sleepSummary}>
              <View style={styles.summaryItem}>
                <Animated.Text style={styles.summaryValue}>{formatSleepDuration(lastNight.totalSleepTime)}</Animated.Text>
                <Animated.Text style={styles.summaryLabel}>{tHome('duration')}</Animated.Text>
              </View>
              <View style={styles.summaryItem}>
                <Animated.Text style={styles.summaryValue}>{lastNight.sleepEfficiency ? `${lastNight.sleepEfficiency}%` : '--'}</Animated.Text>
                <Animated.Text style={styles.summaryLabel}>{tSleep('sleepEfficiency')}</Animated.Text>
              </View>
              <View style={styles.summaryItem}>
                <Animated.Text style={styles.summaryValue}>{lastNight.cyclesCount || '--'}</Animated.Text>
                <Animated.Text style={styles.summaryLabel}>{tHome('cycles')}</Animated.Text>
              </View>
              <View style={styles.summaryItem}>
                <Animated.Text style={styles.summaryValue}>{getQualityLabel(lastNight.qualityRating)}</Animated.Text>
                <Animated.Text style={styles.summaryLabel}>{tSleep('quality')}</Animated.Text>
              </View>
            </View>
            
            {lastNight.wakeTriggerReason && (
              <Animated.Text style={styles.wakeReason}>
                {tAlarm('triggerReason', { reason: lastNight.wakeTriggerReason })}
              </Animated.Text>
            )}
          </Animated.View>
        )}

        {__DEV__ && (
          <AnimatedButton
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => navigation.navigate('DevTools')}
            icon="🛠"
            iconPosition="left"
            style={styles.devButton}
          >
            {tHome('devTools')}
          </AnimatedButton>
        )}
      </ScrollView>

      <AnimatedButton
        variant="ghost"
        size="md"
        onPress={() => navigation.navigate('Settings')}
        icon="⚙️"
        iconPosition="left"
        style={styles.settingsButton}
      >
        {tCommon('settings')}
      </AnimatedButton>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scrollContent: { flex: 1, padding: 20, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 24 },
  time: { fontSize: 76, fontWeight: '200', color: '#fff', letterSpacing: -3 },
  date: { fontSize: 16, color: '#8b9cb3', textTransform: 'capitalize', marginTop: 4 },
  card: { 
    backgroundColor: '#131a2e', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  bedtimeCard: {
    backgroundColor: '#0c2d48',
    borderColor: '#0ea5e9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { 
    fontSize: 14, 
    color: '#8b9cb3', 
    marginBottom: 8, 
    textTransform: 'uppercase', 
    letterSpacing: 1,
    fontWeight: '600',
  },
  smartBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smartBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextAlarm: { fontSize: 40, fontWeight: '600', color: '#fff', marginTop: 8 },
  alarmSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  alarmLabel: { fontSize: 13, color: '#0ea5e9', marginTop: 8, fontWeight: '500' },
  bedtime: { fontSize: 40, fontWeight: '600', color: '#22d3ee' },
  bedtimeSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  sleepSummary: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 },
  summaryItem: { alignItems: 'center', minWidth: '40%' },
  summaryValue: { fontSize: 26, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 12, color: '#8b9cb3', marginTop: 2 },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  wakeReason: { fontSize: 12, color: '#64748b', marginTop: 16, textAlign: 'center', fontStyle: 'italic' },
  devButton: { marginTop: 20 },
  settingsButton: { position: 'absolute', bottom: 30, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingSpinner: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#8b9cb3', fontSize: 16, marginTop: 16 },
});