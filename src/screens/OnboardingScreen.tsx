import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, PermissionsAndroid, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as IntentLauncher from 'expo-intent-launcher';
import { applicationId } from 'expo-application';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { getNotificationService } from '@/modules/notifications';
import { getAlarmEngine } from '@/modules/alarm-engine';

type OnboardingStep = 'welcome' | 'permissions' | 'profile';

const CHRONOTYPE_QUESTIONS = [
  {
    id: 'wake_preference',
    question: 'wakePreference',
    options: [
      { label: 'before6am', value: -2 },
      { label: 'between6and7', value: -1 },
      { label: 'between7and8', value: 0 },
      { label: 'between8and9', value: 1 },
      { label: 'after9am', value: 2 },
    ],
  },
  {
    id: 'sleep_preference',
    question: 'sleepPreference',
    options: [
      { label: 'before10pm', value: -2 },
      { label: 'between10and11', value: -1 },
      { label: 'between11and12', value: 0 },
      { label: 'between12and1', value: 1 },
      { label: 'after1am', value: 2 },
    ],
  },
  {
    id: 'energy_morning',
    question: 'energyMorning',
    options: [
      { label: 'veryEnergetic', value: -2 },
      { label: 'energetic', value: -1 },
      { label: 'average', value: 0 },
      { label: 'tired', value: 1 },
      { label: 'veryTired', value: 2 },
    ],
  },
  {
    id: 'energy_evening',
    question: 'energyEvening',
    options: [
      { label: 'veryTired', value: -2 },
      { label: 'tired', value: -1 },
      { label: 'average', value: 0 },
      { label: 'energetic', value: 1 },
      { label: 'veryEnergetic', value: 2 },
    ],
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation();
  const { t, tCommon, tOnboarding, tProfile } = useI18n();

  // Skip onboarding if already completed (e.g. app restart).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = getUserProfileManager().getProfile();
        if (profile?.onboardingComplete && mounted) {
          navigation.replace('Home');
        } else if (mounted) {
          const full = await getUserProfileManager().initialize();
          if (full?.onboardingComplete && mounted) {
            navigation.replace('Home');
          }
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [navigation]);
  
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [permissions, setPermissions] = useState({
    microphone: false,
    notifications: false,
    exactAlarms: false,
  });
  const [permissionLoading, setPermissionLoading] = useState<string | null>(null);
  
  const [chronotypeAnswers, setChronotypeAnswers] = useState<Record<string, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [chronotype, setChronotype] = useState<'morning' | 'evening' | 'intermediate'>('intermediate');
  
  const [firstAlarmTime, setFirstAlarmTime] = useState('07:00');
  const [saving, setSaving] = useState(false);

  const requestMicrophonePermission = useCallback(async () => {
    setPermissionLoading('microphone');
    try {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: tOnboarding('allowMicrophone'),
          message: tOnboarding('microphoneNeeded'),
          buttonPositive: tCommon('ok'),
          buttonNegative: tCommon('cancel'),
        }
      );
      setPermissions(prev => ({ ...prev, microphone: status === PermissionsAndroid.RESULTS.GRANTED }));
    } catch (e) {
      console.error('Microphone permission error:', e);
    } finally {
      setPermissionLoading(null);
    }
  }, [tOnboarding, tCommon]);

  const requestNotificationPermission = useCallback(async () => {
    setPermissionLoading('notifications');
    try {
      const notifService = getNotificationService();
      await notifService.initialize();
      const perms = await notifService.requestPermissions();
      setPermissions(prev => ({ ...prev, notifications: perms.granted }));
    } catch (e) {
      console.error('Notification permission error:', e);
    } finally {
      setPermissionLoading(null);
    }
  }, []);

  // SCHEDULE_EXACT_ALARM is a special permission: it cannot be requested via
  // a runtime dialog. Open the dedicated system screen directly, then
  // re-check when the user comes back (see AppState effect below).
  const checkExactAlarm = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || (Platform.Version as number) < 31) {
      setPermissions(prev => ({ ...prev, exactAlarms: true }));
      return true;
    }
    try {
      const granted = await PermissionsAndroid.check('android.permission.SCHEDULE_EXACT_ALARM' as any);
      setPermissions(prev => ({ ...prev, exactAlarms: granted }));
      return granted;
    } catch (e) {
      console.error('Exact alarm permission error:', e);
      return false;
    }
  }, []);

  const requestExactAlarmPermission = useCallback(async () => {
    setPermissionLoading('exactAlarms');
    try {
      const granted = await checkExactAlarm();
      if (!granted && Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync(
          'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
          applicationId ? { data: `package:${applicationId}` } : undefined
        );
        // The AppState effect below re-checks on return.
      }
    } finally {
      setPermissionLoading(null);
    }
  }, [checkExactAlarm]);

  // When returning from system Settings, silently re-check exact alarms.
  useEffect(() => {
    if (step !== 'permissions') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkExactAlarm();
      }
    });
    return () => sub.remove();
  }, [step, checkExactAlarm]);

  const requestAllPermissions = useCallback(async () => {
    await requestMicrophonePermission();
    await requestNotificationPermission();
    await requestExactAlarmPermission();
  }, [requestMicrophonePermission, requestNotificationPermission, requestExactAlarmPermission]);

  const handleChronotypeAnswer = useCallback((questionId: string, value: number) => {
    setChronotypeAnswers(prev => ({ ...prev, [questionId]: value }));
    
    const total = Object.values(chronotypeAnswers).reduce((a, b) => a + b, 0) + value;
    if (total <= -3) setChronotype('morning');
    else if (total >= 3) setChronotype('evening');
    else setChronotype('intermediate');
    
    if (currentQuestion < CHRONOTYPE_QUESTIONS.length) {
      setCurrentQuestion(prev => prev + 1);
    }
  }, [chronotypeAnswers, currentQuestion]);

  const goBackQuestion = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  }, [currentQuestion]);

  const saveProfileAndAlarm = useCallback(async () => {
    setSaving(true);
    try {
      const profileManager = getUserProfileManager();
      const alarmEngine = getAlarmEngine();
      
      // Save profile
      await profileManager.updateSleepPreferences({
        chronotype,
        sleepCycleLength: 90 * 60 * 1000,
        fallAsleepDuration: 15 * 60 * 1000,
        desiredCycles: 5,
        typicalBedtime: '22:30',
        typicalWakeTime: firstAlarmTime,
      });
      
      // Create first alarm
      const now = new Date();
      const [h, m] = firstAlarmTime.split(':').map(Number);
      const wakeStart = new Date(now);
      wakeStart.setHours(h, m, 0, 0);
      if (wakeStart <= now) wakeStart.setDate(wakeStart.getDate() + 1);
      const wakeEnd = new Date(wakeStart.getTime() + 90 * 60 * 1000);
      
      const firstAlarm = {
        id: `first_${Date.now()}`,
        label: tOnboarding('firstAlarmLabel', { time: firstAlarmTime }),
        wakeWindowStart: wakeStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        wakeWindowEnd: wakeEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };
      
      alarmEngine.addAlarm(firstAlarm);
      
      // Mark onboarding complete
      await profileManager.updateProfile({ onboardingComplete: true });
      
      navigation.replace('Home');
    } catch (e) {
      console.error('Save profile error:', e);
      Alert.alert(tCommon('error'), tCommon('tryAgain'));
    } finally {
      setSaving(false);
    }
  }, [chronotype, firstAlarmTime, navigation]);

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{tOnboarding('welcome')}</Text>
      <Text style={styles.stepSubtitle}>{tOnboarding('subtitle')}</Text>
      
      <View style={styles.featureList}>
        {[
          { icon: '🎯', title: tOnboarding('step1'), desc: tOnboarding('step1Desc') },
          { icon: '⏰', title: tOnboarding('step2'), desc: tOnboarding('step2Desc') },
          { icon: '🌅', title: tOnboarding('step3'), desc: tOnboarding('step3Desc') },
          { icon: '🌙', title: tOnboarding('step4'), desc: tOnboarding('step4Desc') },
        ].map((feature, i) => (
          <View key={i} style={styles.featureItem}>
            <Text style={styles.featureIcon}>{feature.icon}</Text>
            <View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>
      
      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('permissions')}>
        <Text style={styles.primaryButtonText}>{tOnboarding('getStarted')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{tOnboarding('permissions')}</Text>
      <Text style={styles.stepSubtitle}>{tOnboarding('permissionsDesc')}</Text>
      
      <View style={styles.permissionList}>
        {[
          { 
            key: 'microphone', 
            icon: '🎤', 
            title: tOnboarding('allowMicrophone'), 
            desc: tOnboarding('microphoneNeeded'),
            granted: permissions.microphone,
            loading: permissionLoading === 'microphone',
            onPress: requestMicrophonePermission,
          },
          { 
            key: 'notifications', 
            icon: '🔔', 
            title: tOnboarding('allowNotifications'), 
            desc: tOnboarding('notificationsNeeded'),
            granted: permissions.notifications,
            loading: permissionLoading === 'notifications',
            onPress: requestNotificationPermission,
          },
          { 
            key: 'exactAlarms', 
            icon: '⏰', 
            title: tOnboarding('allowExactAlarms'), 
            desc: tOnboarding('exactAlarmsNeeded'),
            granted: permissions.exactAlarms,
            loading: permissionLoading === 'exactAlarms',
            onPress: requestExactAlarmPermission,
          },
        ].map((perm) => (
          <TouchableOpacity 
            key={perm.key} 
            style={[
              styles.permissionItem, 
              perm.granted && styles.permissionGranted,
              perm.loading && styles.permissionLoading
            ]}
            onPress={perm.loading ? undefined : perm.onPress}
            disabled={perm.loading || perm.granted}
          >
            <View style={styles.permissionIcon}>
              <Text style={styles.permissionIconText}>{perm.icon}</Text>
              {perm.loading && <Text style={styles.loadingSpinner}>⟳</Text>}
              {perm.granted && !perm.loading && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <View style={styles.permissionContent}>
              <Text style={[styles.permissionTitle, perm.granted && styles.permissionTitleGranted]}>{perm.title}</Text>
              <Text style={[styles.permissionDesc, perm.granted && styles.permissionDescGranted]}>{perm.desc}</Text>
            </View>
            <Text style={styles.permissionAction}>
              {perm.loading ? tCommon('loading') : perm.granted ? tCommon('ok') : tCommon('enable')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={[styles.primaryButton, !(permissions.microphone && permissions.notifications && permissions.exactAlarms) && styles.buttonDisabled]}
        onPress={() => setStep('profile')}
        disabled={!(permissions.microphone && permissions.notifications && permissions.exactAlarms)}
      >
        <Text style={styles.primaryButtonText}>{tOnboarding('next')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProfile = () => {
    const question = CHRONOTYPE_QUESTIONS[currentQuestion];
    const progress = (currentQuestion + 1) / CHRONOTYPE_QUESTIONS.length;
    
    if (currentQuestion < CHRONOTYPE_QUESTIONS.length) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>{tOnboarding('chronotypeQuiz')}</Text>
          <Text style={styles.stepSubtitle}>{tOnboarding('chronotypeQuizDesc')}</Text>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{tOnboarding('question', { current: currentQuestion + 1, total: CHRONOTYPE_QUESTIONS.length })}</Text>
          
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{tProfile(question.question)}</Text>
            <View style={styles.optionsGrid}>
              {question.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.optionButton,
                    chronotypeAnswers[question.id] === opt.value && styles.optionSelected
                  ]}
                  onPress={() => handleChronotypeAnswer(question.id, opt.value)}
                >
                  <Text style={styles.optionLabel}>{tProfile(opt.label)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.questionNav}>
            <TouchableOpacity 
              style={[styles.secondaryButton, styles.questionNavButton, currentQuestion === 0 && styles.buttonDisabled]}
              onPress={goBackQuestion}
              disabled={currentQuestion === 0}
            >
              <Text style={styles.secondaryButtonText}>{tCommon('back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.primaryButton, styles.questionNavButton]}
              onPress={() => {
                if (currentQuestion === CHRONOTYPE_QUESTIONS.length - 1) {
                  setCurrentQuestion(CHRONOTYPE_QUESTIONS.length);
                }
              }}
              disabled={chronotypeAnswers[question.id] === undefined}
            >
              <Text style={styles.primaryButtonText}>
                {currentQuestion === CHRONOTYPE_QUESTIONS.length - 1 ? tOnboarding('seeResult') : tCommon('next')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Show result + first alarm setup
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{tOnboarding('yourChronotype')}</Text>
        <View style={styles.chronotypeResult}>
          <Text style={[styles.chronotypeIcon, { fontSize: 64 }]}>
            {chronotype === 'morning' ? '🌅' : chronotype === 'evening' ? '🌙' : '☀️'}
          </Text>
          <Text style={styles.chronotypeLabel}>{tOnboarding(`chronotype.${chronotype}`)}</Text>
          <Text style={styles.chronotypeDesc}>{tOnboarding(`chronotype.${chronotype}Desc`)}</Text>
        </View>
        
        <View style={styles.alarmSetup}>
          <Text style={styles.sectionTitle}>{tOnboarding('firstAlarm')}</Text>
          <TouchableOpacity style={styles.timePicker} onPress={() => {}}>
            <Text style={styles.timePickerLabel}>{tOnboarding('wakeUpAt')}</Text>
            <Text style={styles.timePickerValue}>{firstAlarmTime}</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>{tOnboarding('smartWakeWindow')}</Text>
        </View>
        
        <TouchableOpacity style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={saveProfileAndAlarm} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? tCommon('loading') : tOnboarding('startUsing')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {step === 'welcome' && renderWelcome()}
        {step === 'permissions' && renderPermissions()}
        {step === 'profile' && renderProfile()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 24, paddingBottom: 40 },
  stepContainer: { alignItems: 'center' },
  stepTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  stepSubtitle: { fontSize: 16, color: '#8b9cb3', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  
  featureList: { width: '100%', marginBottom: 32 },
  featureItem: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'flex-start' },
  featureIcon: { fontSize: 28, marginTop: 2 },
  featureTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  featureDesc: { fontSize: 14, color: '#8b9cb3', lineHeight: 20 },
  
  primaryButton: { width: '100%', paddingVertical: 16, backgroundColor: '#0ea5e9', borderRadius: 12, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: { width: '100%', paddingVertical: 14, backgroundColor: '#1e293b', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryButtonText: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  
  permissionList: { width: '100%', gap: 12, marginBottom: 24 },
  permissionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    padding: 16, 
    backgroundColor: '#131a2e', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#1e293b' 
  },
  permissionGranted: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  permissionLoading: { opacity: 0.7 },
  permissionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  permissionIconText: { fontSize: 24 },
  loadingSpinner: { position: 'absolute', fontSize: 20, color: '#0ea5e9' },
  checkMark: { position: 'absolute', fontSize: 20, color: '#22c55e' },
  permissionContent: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  permissionTitleGranted: { color: '#22c55e' },
  permissionDesc: { fontSize: 13, color: '#8b9cb3', marginTop: 2 },
  permissionDescGranted: { color: '#16a34a' },
  permissionAction: { fontSize: 14, fontWeight: '600', color: '#0ea5e9' },
  
  progressBar: { width: '100%', height: 6, backgroundColor: '#1e293b', borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0ea5e9', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#8b9cb3', marginBottom: 24, textAlign: 'center' },
  
  questionCard: { width: '100%', backgroundColor: '#131a2e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  questionText: { fontSize: 18, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionButton: { 
    flex: 1, 
    minWidth: '45%', 
    padding: 16, 
    backgroundColor: '#0a0e1a', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#1e293b',
    alignItems: 'center'
  },
  optionSelected: { borderColor: '#0ea5e9', backgroundColor: '#0c2d48' },
  optionLabel: { fontSize: 14, color: '#e2e8f0', textAlign: 'center' },
  
  questionNav: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  questionNavButton: { flex: 1, width: 'auto', marginTop: 0 },
  
  chronotypeResult: { 
    alignItems: 'center', 
    marginVertical: 24, 
    padding: 24, 
    backgroundColor: '#131a2e', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#0ea5e9' 
  },
  chronotypeIcon: { marginBottom: 12 },
  chronotypeLabel: { fontSize: 24, fontWeight: '700', color: '#0ea5e9' },
  chronotypeDesc: { fontSize: 14, color: '#8b9cb3', marginTop: 8, textAlign: 'center' },
  
  alarmSetup: { width: '100%', marginTop: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  timePicker: { 
    width: '100%', 
    padding: 20, 
    backgroundColor: '#131a2e', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#1e293b',
    alignItems: 'center'
  },
  timePickerLabel: { fontSize: 14, color: '#8b9cb3', marginBottom: 4 },
  timePickerValue: { fontSize: 42, fontWeight: '700', color: '#fff' },
  helpText: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center' },
});