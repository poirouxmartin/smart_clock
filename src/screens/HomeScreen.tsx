import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { createBedtimeCalculator } from '@/modules/bedtime-calculator';
import { getAlarmEngine } from '@/modules/alarm-engine';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { useSlideUp } from '@/hooks/useAnimatedStyles';
import type { RootStackParamList, SleepSession } from '@/types';

type HomeNav = React.NavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { tHome, tAlarm, tSleep, formatTime, formatDuration, currentLocale } = useI18n();

  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [nextAlarm, setNextAlarm] = useState<{ label: string; windowStart: string; windowEnd: string } | null>(null);
  const [bedtime, setBedtime] = useState<{ time: string; cycles: number } | null>(null);
  const [lastNight, setLastNight] = useState<SleepSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const pulseAnim = useSharedValue(1);

  const headerAnim = useSlideUp(0, 600, 40);
  const alarmCardAnim = useSlideUp(150, 600, 30);
  const bedtimeCardAnim = useSlideUp(250, 600, 30);
  const actionsAnim = useSlideUp(350, 600, 30);
  const lastNightAnim = useSlideUp(450, 600, 30);

  const loadData = useCallback(async () => {
    try {
      const profileManager = getUserProfileManager();
      const profile = profileManager.getProfile();
      if (!profile?.onboardingComplete) {
        navigation.replace('EnrichedOnboarding');
        return;
      }
      setOnboardingDone(true);

      const bedtimeCalc = createBedtimeCalculator();
      const alarmEngine = getAlarmEngine();

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
        setBedtime({ time: formatTime(new Date(result.idealBedtime)), cycles: result.cycles });
      }

      const sessions = await profileManager.getRecentSessions(1);
      if (sessions.length > 0) setLastNight(sessions[0]);
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
    headerAnim.trigger();
    alarmCardAnim.trigger();
    bedtimeCardAnim.trigger();
    actionsAnim.trigger();
    lastNightAnim.trigger();
  }, [loadData]);

  if (!onboardingDone) {
    return (
      <LinearGradient colors={['#0a0e1a', '#0f172a']} style={styles.container}>
        <View style={styles.loading}>
          <Ionicons name="moon" size={48} color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </LinearGradient>
    );
  }

  const formatSleepDuration = (ms?: number) => {
    if (!ms) return '--';
    return formatDuration(ms);
  };

  const getQualityColor = (rating?: SleepSession['qualityRating']) => {
    if (!rating) return Colors.textDim;
    const map: Record<SleepSession['qualityRating'], string> = {
      great: Colors.success,
      good: Colors.successDark,
      ok: Colors.warning,
      poor: Colors.danger,
    };
    return map[rating];
  };

  const getQualityLabel = (rating?: SleepSession['qualityRating']) => {
    if (!rating) return '--';
    const map: Record<SleepSession['qualityRating'], string> = {
      great: 'Excellente',
      good: 'Bonne',
      ok: 'Moyenne',
      poor: 'Mauvaise',
    };
    return map[rating];
  };

  const getQualityIcon = (rating?: SleepSession['qualityRating']): keyof typeof Ionicons.glyphMap => {
    if (!rating) return 'help-circle-outline';
    const map: Record<SleepSession['qualityRating'], keyof typeof Ionicons.glyphMap> = {
      great: 'star',
      good: 'thumbs-up',
      ok: 'remove-circle-outline',
      poor: 'alert-circle-outline',
    };
    return map[rating];
  };

  return (
    <LinearGradient colors={['#0a0e1a', '#0f172a', '#1e1b4b']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.header, headerAnim.animatedStyle]}>
            <Ionicons name="moon" size={20} color={Colors.accent} style={{ marginBottom: 8 }} />
            <Animated.Text style={styles.time}>{timeString}</Animated.Text>
            <Animated.Text style={styles.date}>{dateString}</Animated.Text>
          </Animated.View>

          {nextAlarm && (
            <Animated.View style={[alarmCardAnim.animatedStyle]}>
              <LinearGradient colors={[Colors.bgCard, Colors.bgCardAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.alarmGradient}>
                <View style={styles.alarmHeader}>
                  <View style={styles.alarmTitleRow}>
                    <Ionicons name="alarm-outline" size={18} color={Colors.primary} />
                    <Text style={styles.alarmTitleText}>Prochain réveil</Text>
                  </View>
                  <View style={styles.smartBadge}>
                    <Ionicons name="sparkles" size={12} color="#fff" />
                    <Text style={styles.smartBadgeText}>SMART</Text>
                  </View>
                </View>
                <Text style={styles.alarmTime}>{nextAlarm.windowStart} — {nextAlarm.windowEnd}</Text>
                <Text style={styles.alarmSubtitle}>Fenêtre intelligente 1h30</Text>
                <View style={styles.alarmLabelRow}>
                  <Ionicons name="label-outline" size={14} color={Colors.primaryLight} />
                  <Text style={styles.alarmLabel}>{nextAlarm.label}</Text>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {bedtime && (
            <Animated.View style={[bedtimeCardAnim.animatedStyle]}>
              <LinearGradient colors={[Colors.bgCardAlt, Colors.bgCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bedtimeGradient}>
                <View style={styles.bedtimeHeader}>
                  <Ionicons name="bed-outline" size={18} color={Colors.accent} />
                  <Text style={styles.bedtimeTitleText}>Heure de coucher</Text>
                </View>
                <Text style={styles.bedtime}>{bedtime.time}</Text>
                <Text style={styles.bedtimeSubtitle}>{bedtime.cycles} cycles complets recommandés</Text>
              </LinearGradient>
            </Animated.View>
          )}

          <Animated.View style={[styles.actionsGrid, actionsAnim.animatedStyle]}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SleepMode')}>
              <LinearGradient colors={[Colors.purple + '30', Colors.purple + '10']} style={styles.actionCardInner}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.purple + '30' }]}>
                  <Ionicons name="moon" size={24} color={Colors.purple} />
                </View>
                <Text style={styles.actionLabel}>Mode{'\n'}Sommeil</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Stats')}>
              <LinearGradient colors={[Colors.primary + '30', Colors.primary + '10']} style={styles.actionCardInner}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '30' }]}>
                  <Ionicons name="bar-chart" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>Stats &{'\n'}Graphiques</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AlarmSetup')}>
              <LinearGradient colors={[Colors.success + '30', Colors.success + '10']} style={styles.actionCardInner}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.success + '30' }]}>
                  <Ionicons name="alarm-outline" size={24} color={Colors.success} />
                </View>
                <Text style={styles.actionLabel}>Nouveau{'\n'}Réveil</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SleepAnalysis')}>
              <LinearGradient colors={[Colors.warning + '30', Colors.warning + '10']} style={styles.actionCardInner}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.warning + '30' }]}>
                  <Ionicons name="analytics-outline" size={24} color={Colors.warning} />
                </View>
                <Text style={styles.actionLabel}>Analyse{'\n'}Sommeil</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {lastNight && (
            <Animated.View style={[lastNightAnim.animatedStyle]}>
              <LinearGradient colors={[Colors.bgCard, Colors.bgCard]} style={styles.lastNightCard}>
                <View style={styles.lastNightHeader}>
                  <View style={styles.lastNightTitleRow}>
                    <Ionicons name="cloudy-night" size={18} color={Colors.textMuted} />
                    <Text style={styles.lastNightTitle}>Hier soir</Text>
                  </View>
                  <View style={[styles.qualityBadge, { backgroundColor: getQualityColor(lastNight.qualityRating) + '20' }]}>
                    <Ionicons name={getQualityIcon(lastNight.qualityRating)} size={14} color={getQualityColor(lastNight.qualityRating)} />
                    <Text style={[styles.qualityText, { color: getQualityColor(lastNight.qualityRating) }]}>{getQualityLabel(lastNight.qualityRating)}</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={20} color={Colors.primary} />
                    <Text style={styles.statValue}>{formatSleepDuration(lastNight.totalSleepTime)}</Text>
                    <Text style={styles.statLabel}>Durée</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="pulse-outline" size={20} color={Colors.success} />
                    <Text style={styles.statValue}>{lastNight.sleepEfficiency ? `${lastNight.sleepEfficiency}%` : '--'}</Text>
                    <Text style={styles.statLabel}>Efficacité</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="repeat-outline" size={20} color={Colors.accent} />
                    <Text style={styles.statValue}>{lastNight.cyclesCount || '--'}</Text>
                    <Text style={styles.statLabel}>Cycles</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('SleepMode')}>
            <Ionicons name="moon" size={22} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bottomButton, styles.bottomButtonCenter]} onPress={() => navigation.navigate('AlarmSetup')}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  time: { ...Typography.clock, textAlign: 'center' },
  date: { ...Typography.body, color: Colors.textMuted, textTransform: 'capitalize', marginTop: Spacing.xs },

  alarmGradient: { borderRadius: Radius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.primary + '30' },
  alarmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  alarmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  alarmTitleText: { ...Typography.label },
  smartBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  smartBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  alarmTime: { fontSize: 36, fontWeight: '600', color: Colors.text },
  alarmSubtitle: { ...Typography.caption, marginTop: Spacing.xs },
  alarmLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  alarmLabel: { ...Typography.bodySmall, color: Colors.primaryLight, fontWeight: '500' },

  bedtimeGradient: { borderRadius: Radius.xl, padding: Spacing.xxl, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '30' },
  bedtimeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  bedtimeTitleText: { ...Typography.label, color: Colors.accent },
  bedtime: { fontSize: 42, fontWeight: '700', color: Colors.accent },
  bedtimeSubtitle: { ...Typography.caption, marginTop: Spacing.xs },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xl },
  actionCard: { width: '47%', borderRadius: Radius.xl, overflow: 'hidden' },
  actionCardInner: { padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, minHeight: 110, justifyContent: 'center' },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  actionLabel: { ...Typography.bodySmall, fontWeight: '600', textAlign: 'center', lineHeight: 18 },

  lastNightCard: { borderRadius: Radius.xl, padding: Spacing.xxl, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  lastNightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  lastNightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lastNightTitle: { ...Typography.label },
  qualityBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  qualityText: { fontSize: 13, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  statLabel: { ...Typography.caption, marginTop: Spacing.xs },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  bottomBar: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, paddingHorizontal: Spacing.xxxl },
  bottomButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  bottomButtonCenter: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, borderWidth: 0 },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { ...Typography.body, color: Colors.textMuted },
});
