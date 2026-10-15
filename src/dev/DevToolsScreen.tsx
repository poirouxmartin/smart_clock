import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioRecorder, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Accelerometer } from 'expo-sensors';
import { SleepAnalyzer, AudioFeatures, AccelFeatures, SleepEpochFeatures } from '@/modules/sleep-analysis';
import { AlarmEngine, createAlarmEngine, ActiveAlarm, AlarmConfig } from '@/modules/alarm-engine';
import { SoundManager, getSoundManager, PlaybackStatus } from '@/modules/sound-manager';
import { LightController, getLightController, LightDevice, LightState } from '@/modules/light-controller';
import { BedtimeCalculator, createBedtimeCalculator, BedtimeCalculationInput, BedtimeResult } from '@/modules/bedtime-calculator';
import { UserProfileManager, getUserProfileManager, UserProfile, SleepSession, AdaptiveLearningData } from '@/modules/user-profile';
import { NotificationService, getNotificationService, NotificationPreferences } from '@/modules/notifications';
import { I18nService, getI18nService, SupportedLocale } from '@/modules/i18n';

const CHUNK_DURATION_MS = 1000;
const SAMPLE_RATE = 16000;
const SAMPLES_PER_CHUNK = SAMPLE_RATE * (CHUNK_DURATION_MS / 1000);

export function DevToolsScreen() {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [currentAudioFeatures, setCurrentAudioFeatures] = useState<AudioFeatures | null>(null);
  const [currentAccelFeatures, setCurrentAccelFeatures] = useState<AccelFeatures | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState<SleepEpochFeatures | null>(null);
  const [epochHistory, setEpochHistory] = useState<SleepEpochFeatures[]>([]);
  const [wakeTrigger, setWakeTrigger] = useState<{shouldWake: boolean; confidence: number; reason: string} | null>(null);

  const [alarmEngineState, setAlarmEngineState] = useState<{
    initialized: boolean;
    activeAlarms: ActiveAlarm[];
    nextWakeTime: number | null;
  }>({ initialized: false, activeAlarms: [], nextWakeTime: null });

  const [soundManagerState, setSoundManagerState] = useState<{
    initialized: boolean;
    status: PlaybackStatus | null;
    sounds: Array<{id: string; name: string; type: string}>;
  }>({ initialized: false, status: null, sounds: [] });

  const [lightControllerState, setLightControllerState] = useState<{
    initialized: boolean;
    devices: LightDevice[];
    deviceStates: Map<string, LightState>;
    discovering: boolean;
  }>({ initialized: false, devices: [], deviceStates: new Map(), discovering: false });

  const [bedtimeState, setBedtimeState] = useState<{
    initialized: boolean;
    result: BedtimeResult | null;
    input: BedtimeCalculationInput;
  }>({ initialized: false, result: null, input: {} as BedtimeCalculationInput });

  const [userProfileState, setUserProfileState] = useState<{
    initialized: boolean;
    profile: UserProfile | null;
    learning: AdaptiveLearningData | null;
    sessions: SleepSession[];
  }>({ initialized: false, profile: null, learning: null, sessions: [] });

  const [notificationState, setNotificationState] = useState<{
    initialized: boolean;
    permissions: any;
    pushToken: string | null;
    preferences: NotificationPreferences;
    scheduledCount: number;
  }>({ initialized: false, permissions: null, pushToken: null, preferences: {} as NotificationPreferences, scheduledCount: 0 });

  const [i18nState, setI18nState] = useState<{
    initialized: boolean;
    currentLocale: SupportedLocale;
    locales: SupportedLocale[];
    isRTL: boolean;
  }>({ initialized: false, currentLocale: 'fr', locales: [], isRTL: false });

  const analyzerRef = useRef<SleepAnalyzer>(new SleepAnalyzer());
  const bedtimeCalcRef = useRef<BedtimeCalculator>(createBedtimeCalculator());
  const profileManagerRef = useRef<UserProfileManager | null>(null);
  const engineRef = useRef<AlarmEngine | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  const lightControllerRef = useRef<LightController | null>(null);
  const recordingRef = useRef<any | null>(null);
  const recorderHook = useAudioRecorder(
    {
      extension: '.m4a',
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 1,
      bitRate: 128000,
      android: {
        outputFormat: 'mpeg4',
        audioEncoder: 'aac',
      },
      ios: {
        outputFormat: 'm4a',
        audioQuality: 'max',
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    },
    (status) => {
      if (status.isRecording && status.durationMillis) {
        const elapsed = Math.floor(status.durationMillis / 1000);
        setRecordingTime(elapsed);
      }
    }
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const samplesCollectedRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    accelSubRef.current = Accelerometer.addListener(data => {
      const timestamp = Date.now();
      const accelFeatures = analyzerRef.current.processAccelData(data.x, data.y, data.z, timestamp);
      setCurrentAccelFeatures(accelFeatures);
    });
    return () => {
      accelSubRef.current?.remove();
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const engine = createAlarmEngine({
      enableForegroundService: false,
    });
    engine.setSleepAnalyzer(analyzerRef.current);
    engine.setCallbacks({
      onAlarmTrigger: (alarm, result) => {
        addLog(`🔔 RÉVEIL DÉCLENCHÉ: ${result.reason} (conf: ${result.confidence.toFixed(2)})`);
        // Trigger alarm sound
        if (soundManagerRef.current) {
          soundManagerRef.current.playAlarm(alarm.alarm.soundId, alarm.alarm.volume, 30000);
        }
      },
      onStateChange: (alarm) => {
        updateEngineState();
      },
      onError: (error, context) => {
        addLog(`❌ Erreur ${context}: ${error.message}`);
      },
    });
    engineRef.current = engine;
    engine.initialize().then(() => {
      setAlarmEngineState(prev => ({ ...prev, initialized: true }));
      addLog('AlarmEngine initialisé');
    });
    
    return () => {
      engine.shutdown();
    };
  }, []);

  useEffect(() => {
    const sm = getSoundManager();
    soundManagerRef.current = sm;
    sm.setStatusCallback((status) => {
      setSoundManagerState(prev => ({ ...prev, status }));
    });
    sm.initialize().then(() => {
      setSoundManagerState(prev => ({ 
        ...prev, 
        initialized: true,
        sounds: sm.getAllSounds().map(s => ({ id: s.id, name: s.name, type: s.type })),
      }));
      addLog('SoundManager initialisé');
    });
    
    return () => {
      sm.destroy();
    };
  }, []);

  useEffect(() => {
    const lc = getLightController({ autoDiscover: false });
    lightControllerRef.current = lc;
    
    lc.onDeviceListChange((devices) => {
      setLightControllerState(prev => ({ ...prev, devices }));
    });
    
    lc.onStateChange((deviceId, state) => {
      setLightControllerState(prev => {
        const next = new Map(prev.deviceStates);
        next.set(deviceId, state);
        return { ...prev, deviceStates: next };
      });
    });
    
    lc.initialize().then(() => {
      setLightControllerState(prev => ({ 
        ...prev, 
        initialized: true,
        devices: lc.getAllDevices(),
      }));
      addLog('LightController initialisé');
    });
    
    return () => {
      lc.shutdown();
    };
  }, []);

  useEffect(() => {
    const calc = createBedtimeCalculator();
    bedtimeCalcRef.current = calc;
    
    const defaultInput: BedtimeCalculationInput = {
      targetWakeTime: Date.now() + 8 * 60 * 60 * 1000,
      sleepCycleLength: 90 * 60 * 1000,
      desiredCycles: 5,
      fallAsleepDuration: 15 * 60 * 1000,
      chronotype: 'intermediate',
    };
    
    const result = calc.calculate(defaultInput);
    setBedtimeState({ initialized: true, result, input: defaultInput });
    addLog('BedtimeCalculator initialisé');
  }, []);

  useEffect(() => {
    const pm = getUserProfileManager();
    profileManagerRef.current = pm;
    
    pm.initialize().then(profile => {
      setUserProfileState(prev => ({ ...prev, initialized: true, profile }));
      addLog('UserProfileManager initialisé');
      return pm.getAdaptiveLearning();
    }).then(learning => {
      setUserProfileState(prev => ({ ...prev, learning }));
    }).catch(e => {
      addLog(`Erreur profil: ${e}`);
    });
    
    return () => {
      // cleanup if needed
    };
  }, []);

  useEffect(() => {
    const ns = getNotificationService();
    ns.initialize().then(() => {
      setNotificationState({
        initialized: true,
        permissions: ns.getPermissions(),
        pushToken: ns.getPushTokenSync()?.token || null,
        preferences: ns.getPreferences(),
        scheduledCount: 0,
      });
      addLog('NotificationService initialisé');
      return ns.getScheduledNotifications();
    }).then(notifs => {
      setNotificationState(prev => ({ ...prev, scheduledCount: notifs.length }));
    }).catch(e => {
      addLog(`Erreur notifications: ${e}`);
    });
    
    return () => {
      ns.shutdown();
    };
  }, []);

  useEffect(() => {
    const i18n = getI18nService();
    i18n.initialize().then(() => {
      setI18nState({
        initialized: true,
        currentLocale: i18n.getCurrentLocale(),
        locales: i18n.getSupportedLocales(),
        isRTL: i18n.isRTL(),
      });
      addLog(`I18nService initialisé: ${i18n.getCurrentLocale()}`);
    }).catch(e => {
      addLog(`Erreur i18n: ${e}`);
    });
    
    return () => {
      // cleanup if needed
    };
  }, []);

  const updateEngineState = () => {
    if (!engineRef.current) return;
    setAlarmEngineState({
      initialized: true,
      activeAlarms: engineRef.current.getAllActiveAlarms(),
      nextWakeTime: engineRef.current.getAllActiveAlarms()[0] 
        ? engineRef.current.getNextWakeTime(engineRef.current.getAllActiveAlarms()[0].alarm.id) 
        : null,
    });
  };

  const processAudioChunk = useCallback((samples: Float32Array) => {
    const timestamp = Date.now();
    const audioFeatures = analyzerRef.current.processAudioChunk(samples, timestamp);
    setCurrentAudioFeatures(audioFeatures);

    const epoch = analyzerRef.current.computeEpochFeatures(timestamp);
    setCurrentEpoch(epoch);
    setEpochHistory(prev => [...prev.slice(-199), epoch]);

    const now = Date.now();
    const windowStart = now - 90 * 60 * 1000;
    const trigger = analyzerRef.current.checkWakeTrigger(windowStart, now, now);
    setWakeTrigger(trigger);
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Erreur', 'Permission microphone refusée');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      await recorderHook.prepareToRecordAsync();
      recorderHook.record();
      recordingRef.current = recorderHook;
      analyzerRef.current.reset();
      setRecording(true);
      setRecordingTime(0);
      setEpochHistory([]);
      setWakeTrigger(null);
      audioBufferRef.current = [];
      samplesCollectedRef.current = 0;
      addLog('Enregistrement démarré - SleepAnalyzer actif');

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      const pollInterval = setInterval(() => {
        if (!recorderHook.isRecording) {
          clearInterval(pollInterval);
          return;
        }
        const elapsed = recorderHook.currentTime;
        const newSamples = Math.floor(elapsed * SAMPLE_RATE);
        if (newSamples > samplesCollectedRef.current) {
          const chunk = new Float32Array(SAMPLES_PER_CHUNK);
          processAudioChunk(chunk);
          samplesCollectedRef.current = 0;
        }
      }, CHUNK_DURATION_MS);

      return () => {
        clearInterval(pollInterval);
      };
    } catch (e) {
      addLog(`Erreur: ${e}`);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopRecording = async () => {
    if (!recorderHook.isRecording) return;
    try {
      timerRef.current && clearInterval(timerRef.current);
      await recorderHook.stop();
      const uri = recorderHook.uri;
      addLog(`Enregistrement arrêté: ${uri}`);
      setRecording(false);
      
      const jsonExport = analyzerRef.current.exportData();
      addLog(`Epochs analysées: ${epochHistory.length}`);
      console.log('=== SLEEP ANALYSIS EXPORT ===\n', jsonExport);
      
    } catch (e) {
      addLog(`Erreur stop: ${e}`);
    }
  };

  const exportJSON = () => {
    const json = analyzerRef.current.exportData();
    addLog('JSON export prêt (console)');
    console.log(json);
  };

  const simulateWakeWindow = () => {
    const now = Date.now();
    const windowStart = now - 30 * 60 * 1000;
    const trigger = analyzerRef.current.checkWakeTrigger(windowStart, now + 60 * 60 * 1000, now);
    setWakeTrigger(trigger);
    addLog(`Simulation fenêtre: ${trigger.shouldWake ? 'RÉVEIL' : 'attente'} - ${trigger.reason} (conf: ${trigger.confidence.toFixed(2)})`);
  };

  const createTestAlarm = (minutesFromNow: number = 2) => {
    if (!engineRef.current) return;
    
    const now = Date.now();
    const wakeStart = now + minutesFromNow * 60 * 1000;
    const wakeEnd = wakeStart + 90 * 60 * 1000;
    
    const testAlarm: AlarmConfig = {
      id: `test_${Date.now()}`,
      label: `Test dans ${minutesFromNow}min`,
      wakeWindowStart: new Date(wakeStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      wakeWindowEnd: new Date(wakeEnd).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      days: [0,1,2,3,4,5,6],
      enabled: true,
      soundId: 'birds',
      volume: 0.7,
      lightEnabled: false,
      vibrationEnabled: true,
      snoozeEnabled: true,
      snoozeDuration: 10,
    };
    
    engineRef.current.addAlarm(testAlarm);
    addLog(`Test alarm créé: démarre dans ${minutesFromNow}min (fenêtre: ${testAlarm.wakeWindowStart} - ${testAlarm.wakeWindowEnd})`);
    updateEngineState();
  };

  const dismissTestAlarm = (alarmId: string) => {
    if (!engineRef.current) return;
    engineRef.current.dismissAlarm(alarmId);
    addLog(`Alarme ${alarmId} rejetée`);
    updateEngineState();
  };

  const snoozeTestAlarm = (alarmId: string) => {
    if (!engineRef.current) return;
    const result = engineRef.current.snoozeAlarm(alarmId);
    addLog(`Alarme ${alarmId} ${result ? 'reportée (snooze)' : 'échec snooze (max atteint)'}`);
    updateEngineState();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🛠 Outils Développeur</Text>
          <Text style={styles.subtitle}>SleepAnalyzer - Détection phase légère temps réel</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enregistrement & Analyse</Text>
          <View style={styles.recordingStatus}>
            <View style={[styles.indicator, recording && styles.indicatorActive]} />
            <Text style={styles.statusText}>{recording ? '🔴 ENREGISTREMENT + ANALYSE' : '⚪ ARRÊT'}</Text>
            <Text style={styles.timer}>{Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2,'0')}</Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, recording ? styles.buttonStop : styles.buttonStart]} 
              onPress={recording ? stopRecording : startRecording}
            >
              <Text style={styles.buttonText}>{recording ? 'Arrêter' : 'Démarrer analyse'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonExport]} onPress={exportJSON}>
              <Text style={styles.buttonText}>Exporter JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSimulate]} onPress={simulateWakeWindow}>
              <Text style={styles.buttonText}>Simuler fenêtre</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Métriques Audio (temps réel)</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RMS</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.rms.toFixed(6) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Centroïde spectral</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.spectralCentroid.toFixed(0) || '0'} Hz</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Flux spectral</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.spectralFlux.toFixed(6) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>ZCR</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.zeroCrossingRate.toFixed(4) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Énergie grave (20-200Hz)</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.lowFreqEnergy.toExponential(2) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Énergie aiguë (200-4000Hz)</Text>
              <Text style={styles.metricValue}>{currentAudioFeatures?.highFreqEnergy.toExponential(2) || '0'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Métriques Accéléromètre</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Magnitude</Text>
              <Text style={styles.metricValue}>{currentAccelFeatures?.magnitude.toFixed(4) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Variance</Text>
              <Text style={styles.metricValue}>{currentAccelFeatures?.variance.toFixed(6) || '0'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Époque Actuelle (30s)</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Score phase légère</Text>
              <Text style={[styles.metricValue, { fontSize: 24, color: currentEpoch && currentEpoch.lightSleepScore > 0.6 ? '#22c55e' : '#fff' }]}>
                {(currentEpoch?.lightSleepScore * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Mouvement</Text>
              <Text style={styles.metricValue}>{currentEpoch?.movementDetected ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Ronflement</Text>
              <Text style={styles.metricValue}>{currentEpoch?.snoringDetected ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Respiration régulière</Text>
              <Text style={styles.metricValue}>{currentEpoch?.regularBreathing ? '✅ OUI' : '❌ NON'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Déclencheur Réveil (fenêtre 1h30 simulée)</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Doit réveiller</Text>
              <Text style={[styles.metricValue, { fontSize: 24, color: wakeTrigger?.shouldWake ? '#22c55e' : '#ef4444' }]}>
                {wakeTrigger?.shouldWake ? 'OUI' : 'NON'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Confiance</Text>
              <Text style={styles.metricValue}>{(wakeTrigger?.confidence * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Raison</Text>
              <Text style={{ ...styles.metricValue, fontSize: 12, textAlign: 'center' }}>{wakeTrigger?.reason || 'En attente...'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historique Score Phase Légère (derniers 5min)</Text>
          <View style={styles.chart}>
            {epochHistory.slice(-300).map((e, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { 
                    height: Math.max(e.lightSleepScore * 100, 2),
                    backgroundColor: e.lightSleepScore > 0.6 ? '#22c55e' : '#0ea5e9',
                  }
                ]}
              />
            ))}
          </View>
          <Text style={styles.chartHint}>Vert = phase légère détectée ({'>'}60%) • Bleu = autre phase</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Logs</Text>
          <View style={styles.logs}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>{log}</Text>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AlarmEngine Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{alarmEngineState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Alarmes actives</Text>
              <Text style={styles.metricValue}>{alarmEngineState.activeAlarms.length}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Prochain réveil</Text>
              <Text style={{ ...styles.metricValue, fontSize: 12 }}>
                {alarmEngineState.nextWakeTime 
                  ? new Date(alarmEngineState.nextWakeTime).toLocaleTimeString('fr-FR')
                  : 'Aucun'}
              </Text>
            </View>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={() => createTestAlarm(1)}>
              <Text style={styles.buttonText}>Test 1min</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={() => createTestAlarm(2)}>
              <Text style={styles.buttonText}>Test 2min</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonExport]} onPress={() => createTestAlarm(5)}>
              <Text style={styles.buttonText}>Test 5min</Text>
            </TouchableOpacity>
          </View>

          {alarmEngineState.activeAlarms.map(alarm => (
            <View key={alarm.alarm.id} style={styles.alarmItem}>
              <Text style={styles.alarmItemLabel}>
                {alarm.alarm.label} • {alarm.state} • Snooze: {alarm.snoozeCount}
              </Text>
              <View style={styles.alarmItemActions}>
                <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={() => snoozeTestAlarm(alarm.alarm.id)}>
                  <Text style={styles.buttonText}>Snooze</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStop]} onPress={() => dismissTestAlarm(alarm.alarm.id)}>
                  <Text style={styles.buttonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SoundManager Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{soundManagerState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>État lecture</Text>
              <Text style={styles.metricValue}>{soundManagerState.status?.state || 'idle'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Son actuel</Text>
              <Text style={{ ...styles.metricValue, fontSize: 12 }}>{soundManagerState.status?.soundId || 'Aucun'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Volume</Text>
              <Text style={styles.metricValue}>{(soundManagerState.status?.volume * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Position</Text>
              <Text style={styles.metricValue}>{soundManagerState.status ? `${Math.floor(soundManagerState.status.position / 1000)}s` : '0s'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Durée</Text>
              <Text style={styles.metricValue}>{soundManagerState.status ? `${Math.floor(soundManagerState.status.duration / 1000)}s` : '0s'}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            {soundManagerState.sounds.slice(0, 6).map(sound => (
              <TouchableOpacity 
                key={sound.id}
                style={[styles.button, styles.buttonSmall, soundManagerState.status?.soundId === sound.id ? styles.buttonStop : styles.buttonStart]} 
                onPress={() => soundManagerRef.current?.play(sound.id, { volume: 0.7, fadeInDuration: 5000 })}
              >
                <Text style={styles.buttonText}>{sound.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={() => soundManagerRef.current?.pause()}>
              <Text style={styles.buttonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={() => soundManagerRef.current?.resume()}>
              <Text style={styles.buttonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStop]} onPress={() => soundManagerRef.current?.stop(true)}>
              <Text style={styles.buttonText}>Stop (fade)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={() => soundManagerRef.current?.playAlarm('birds', 0.8, 10000)}>
              <Text style={styles.buttonText}>Test Alarme (fade 10s)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>LightController Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{lightControllerState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Appareils détectés</Text>
              <Text style={styles.metricValue}>{lightControllerState.devices.length}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Connectés</Text>
              <Text style={styles.metricValue}>{lightControllerState.devices.filter(d => d.isConnected).length}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Découverte</Text>
              <Text style={styles.metricValue}>{lightControllerState.discovering ? '🔄 En cours' : '⏸ Arrêt'}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={() => {
              setLightControllerState(prev => ({ ...prev, discovering: true }));
              lightControllerRef.current?.discoverDevices(10000).then(() => {
                setLightControllerState(prev => ({ ...prev, discovering: false }));
              });
            }}>
              <Text style={styles.buttonText}>Découvrir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonExport]} onPress={() => lightControllerRef.current?.cancelWakeUpLight()}>
              <Text style={styles.buttonText}>Annuler Wake-up</Text>
            </TouchableOpacity>
          </View>

          {lightControllerState.devices.map(device => {
            const state = lightControllerState.deviceStates.get(device.id);
            return (
              <View key={device.id} style={styles.alarmItem}>
                <Text style={styles.alarmItemLabel}>
                  {device.name} ({device.type}) • {device.isConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
                  {state && ` • ${state.on ? '💡 Allumé' : '⭕ Éteint'} • ${state.brightness}%`}
                </Text>
                <View style={styles.alarmItemActions}>
                  <TouchableOpacity style={[styles.button, styles.buttonSmall, state?.on ? styles.buttonStop : styles.buttonStart]} onPress={() => lightControllerRef.current?.turnOn(device.id, 1000)}>
                    <Text style={styles.buttonText}>{state?.on ? 'Éteindre' : 'Allumer'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={() => lightControllerRef.current?.setBrightness(device.id, 50, 2000)}>
                    <Text style={styles.buttonText}>50%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={() => lightControllerRef.current?.setColorTemperature(device.id, 3000, 2000)}>
                    <Text style={styles.buttonText}>3000K</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSimulate]} onPress={() => lightControllerRef.current?.executeWakeUpLight([device.id], { duration: 10000, startBeforeAlarm: 0 })}>
                    <Text style={styles.buttonText}>Test Wake-up (10s)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>BedtimeCalculator Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{bedtimeState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Coucher idéal</Text>
              <Text style={{ ...styles.metricValue, fontSize: 16 }}>
                {bedtimeState.result ? new Date(bedtimeState.result.idealBedtime).toLocaleTimeString('fr-FR') : '—'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Fenêtre</Text>
              <Text style={{ ...styles.metricValue, fontSize: 12 }}>
                {bedtimeState.result 
                  ? `${new Date(bedtimeState.result.bedtimeWindow.start).toLocaleTimeString('fr-FR')} - ${new Date(bedtimeState.result.bedtimeWindow.end).toLocaleTimeString('fr-FR')}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Sommeil total</Text>
              <Text style={styles.metricValue}>
                {bedtimeState.result ? `${Math.floor(bedtimeState.result.totalSleepTime / 3600000)}h ${Math.floor((bedtimeState.result.totalSleepTime % 3600000) / 60000)}min` : '—'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Cycles</Text>
              <Text style={styles.metricValue}>{bedtimeState.result?.cycles || '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Fin cycle</Text>
              <Text style={[styles.metricValue, { color: bedtimeState.result?.wakeUpAtEndOfCycle ? '#22c55e' : '#ef4444' }]}>
                {bedtimeState.result?.wakeUpAtEndOfCycle ? '✅ OUI' : '❌ NON'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Confiance</Text>
              <Text style={styles.metricValue}>{bedtimeState.result ? `${Math.round(bedtimeState.result.confidence * 100)}%` : '—'}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStart]} onPress={() => {
              const input = { ...bedtimeState.input, targetWakeTime: Date.now() + 7 * 60 * 60 * 1000 };
              const result = bedtimeCalcRef.current.calculate(input);
              setBedtimeState(prev => ({ ...prev, result, input }));
              addLog(`Calcul pour 7h: coucher ${new Date(result.idealBedtime).toLocaleTimeString('fr-FR')}`);
            }}>
              <Text style={styles.buttonText}>Test 7h00</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStart]} onPress={() => {
              const input = { ...bedtimeState.input, targetWakeTime: Date.now() + 8 * 60 * 60 * 1000 };
              const result = bedtimeCalcRef.current.calculate(input);
              setBedtimeState(prev => ({ ...prev, result, input }));
              addLog(`Calcul pour 8h00: coucher ${new Date(result.idealBedtime).toLocaleTimeString('fr-FR')}`);
            }}>
              <Text style={styles.buttonText}>Test 8h00</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={() => {
              const input = { ...bedtimeState.input, chronotype: 'morning' as const };
              const result = bedtimeCalcRef.current.calculate(input);
              setBedtimeState(prev => ({ ...prev, result, input }));
              addLog(`Chronotype matin: coucher ${new Date(result.idealBedtime).toLocaleTimeString('fr-FR')}`);
            }}>
              <Text style={styles.buttonText}>Matin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={() => {
              const input = { ...bedtimeState.input, chronotype: 'evening' as const };
              const result = bedtimeCalcRef.current.calculate(input);
              setBedtimeState(prev => ({ ...prev, result, input }));
              addLog(`Chronotype soir: coucher ${new Date(result.idealBedtime).toLocaleTimeString('fr-FR')}`);
            }}>
              <Text style={styles.buttonText}>Soir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={() => {
              const input = { ...bedtimeState.input, desiredCycles: 6 };
              const result = bedtimeCalcRef.current.calculate(input);
              setBedtimeState(prev => ({ ...prev, result, input }));
              addLog(`6 cycles: coucher ${new Date(result.idealBedtime).toLocaleTimeString('fr-FR')}`);
            }}>
              <Text style={styles.buttonText}>6 cycles</Text>
            </TouchableOpacity>
          </View>

          {bedtimeState.result && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Raisonnement :</Text>
              {bedtimeState.result.reasoning.map((r, i) => (
                <Text key={i} style={styles.reasoningItem}>• {r}</Text>
              ))}
            </View>
          )}

          {bedtimeState.result && bedtimeState.result.alternativeBedtimes.length > 0 && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Alternatives :</Text>
              {bedtimeState.result.alternativeBedtimes.map((alt, i) => (
                <Text key={i} style={styles.reasoningItem}>
                  {alt.cycles} cycles → {new Date(alt.bedtime).toLocaleTimeString('fr-FR')} ({alt.pros}) / {alt.cons}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>UserProfileManager Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{userProfileState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Chronotype</Text>
              <Text style={styles.metricValue}>{userProfileState.profile?.chronotype || '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Cycle length</Text>
              <Text style={styles.metricValue}>{userProfileState.profile ? `${Math.round(userProfileState.profile.sleepCycleLength / 60000)}min` : '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Endormissement</Text>
              <Text style={styles.metricValue}>{userProfileState.profile ? `${Math.round(userProfileState.profile.fallAsleepDuration / 60000)}min` : '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Cycles visés</Text>
              <Text style={styles.metricValue}>{userProfileState.profile?.desiredCycles || '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Volume défaut</Text>
              <Text style={styles.metricValue}>{userProfileState.profile ? `${Math.round(userProfileState.profile.defaultVolume * 100)}%` : '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RMS baseline</Text>
              <Text style={styles.metricValue}>{userProfileState.learning ? userProfileState.learning.rmsBaseline.toFixed(4) : '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Accel baseline</Text>
              <Text style={styles.metricValue}>{userProfileState.learning ? userProfileState.learning.accelBaseline.toFixed(4) : '—'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Sessions</Text>
              <Text style={styles.metricValue}>{userProfileState.sessions.length}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStart]} onPress={async () => {
              const pm = profileManagerRef.current;
              if (!pm) return;
              await pm.updateSleepPreferences({ chronotype: 'morning' });
              const p = pm.getProfile();
              setUserProfileState(prev => ({ ...prev, profile: p }));
              addLog('Chronotype mis à jour: morning');
            }}>
              <Text style={styles.buttonText}>Chronotype: Matin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={async () => {
              const pm = profileManagerRef.current;
              if (!pm) return;
              await pm.updateSleepPreferences({ chronotype: 'evening' });
              const p = pm.getProfile();
              setUserProfileState(prev => ({ ...prev, profile: p }));
              addLog('Chronotype mis à jour: evening');
            }}>
              <Text style={styles.buttonText}>Chronotype: Soir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={async () => {
              const pm = profileManagerRef.current;
              if (!pm) return;
              await pm.updateSleepPreferences({ desiredCycles: 6 });
              const p = pm.getProfile();
              setUserProfileState(prev => ({ ...prev, profile: p }));
              addLog('Cycles visés: 6');
            }}>
              <Text style={styles.buttonText}>6 cycles</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSimulate]} onPress={async () => {
              const pm = profileManagerRef.current;
              if (!pm) return;
              const session = await pm.saveSleepSession({
                startTime: Date.now() - 8 * 60 * 60 * 1000,
                endTime: Date.now(),
                targetWakeWindow: { start: Date.now() - 30 * 60 * 1000, end: Date.now() + 60 * 60 * 1000 },
                actualWakeTime: Date.now(),
                wakeTriggerReason: 'Test manual',
                wakeConfidence: 0.9,
                totalSleepTime: 7.5 * 60 * 60 * 1000,
                sleepEfficiency: 85,
                cyclesCount: 5,
                qualityRating: 'good',
                moodRating: 4,
              });
              const sessions = await pm.getRecentSessions(10);
              setUserProfileState(prev => ({ ...prev, sessions }));
              addLog(`Session test sauvegardée: ${session.id}`);
            }}>
              <Text style={styles.buttonText}>Créer session test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStop]} onPress={async () => {
              const pm = profileManagerRef.current;
              if (!pm) return;
              const json = await pm.exportData();
              addLog('Export JSON profil (console)');
              console.log(json);
            }}>
              <Text style={styles.buttonText}>Exporter profil</Text>
            </TouchableOpacity>
          </View>

          {userProfileState.sessions.length > 0 && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Dernières sessions :</Text>
              {userProfileState.sessions.slice(0, 5).map((s, i) => (
                <Text key={i} style={styles.reasoningItem}>
                  {new Date(s.startTime).toLocaleDateString('fr-FR')} • {Math.round((s.totalSleepTime || 0) / 3600000 * 10) / 10}h • {s.sleepEfficiency}% • {s.qualityRating || 'NR'}
                </Text>
              ))}
            </View>
          )}

          {userProfileState.learning && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Apprentissage adaptatif :</Text>
              <Text style={styles.reasoningItem}>RMS baseline: {userProfileState.learning.rmsBaseline.toFixed(6)}</Text>
              <Text style={styles.reasoningItem}>Accel baseline: {userProfileState.learning.accelBaseline.toFixed(6)}</Text>
              <Text style={styles.reasoningItem}>Cycle appris: {Math.round(userProfileState.learning.cycleLength / 60000)}min</Text>
              <Text style={styles.reasoningItem}>Endormissement appris: {Math.round(userProfileState.learning.fallAsleepDuration / 60000)}min</Text>
              <Text style={styles.reasoningItem}>Échantillons: {userProfileState.learning.sampleCount}</Text>
              <Text style={styles.reasoningItem}>MAJ: {new Date(userProfileState.learning.lastUpdated).toLocaleTimeString('fr-FR')}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>NotificationService Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{notificationState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Permissions</Text>
              <Text style={styles.metricValue}>{notificationState.permissions?.granted ? '✅ Accordées' : '❌ Refusées'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Push Token</Text>
              <Text style={{ ...styles.metricValue, fontSize: 10 }}>
                {notificationState.pushToken ? `${notificationState.pushToken.slice(0, 20)}...` : '—'}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Notifs programmées</Text>
              <Text style={styles.metricValue}>{notificationState.scheduledCount}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Alarme activée</Text>
              <Text style={styles.metricValue}>{notificationState.preferences.alarmEnabled ? '✅' : '❌'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Rappel coucher</Text>
              <Text style={styles.metricValue}>{notificationState.preferences.bedtimeReminderEnabled ? '✅' : '❌'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Sons</Text>
              <Text style={styles.metricValue}>{notificationState.preferences.soundEnabled ? '✅' : '❌'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Vibration</Text>
              <Text style={styles.metricValue}>{notificationState.preferences.vibrationEnabled ? '✅' : '❌'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Alertes critiques</Text>
              <Text style={styles.metricValue}>{notificationState.preferences.criticalAlertsEnabled ? '✅' : '❌'}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStart]} onPress={async () => {
              const ns = getNotificationService();
              await ns.requestPermissions();
              setNotificationState(prev => ({ ...prev, permissions: ns.getPermissions() }));
              const token = await ns.getPushToken();
              setNotificationState(prev => ({ ...prev, pushToken: token?.token || null }));
              addLog('Permissions demandées');
            }}>
              <Text style={styles.buttonText}>Demander permissions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={async () => {
              const ns = getNotificationService();
              await ns.updatePreferences({ criticalAlertsEnabled: !notificationState.preferences.criticalAlertsEnabled });
              setNotificationState(prev => ({ ...prev, preferences: ns.getPreferences() }));
              addLog('Alertes critiques basculées');
            }}>
              <Text style={styles.buttonText}>Alertes critiques</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={async () => {
              const ns = getNotificationService();
              const notifs = await ns.getScheduledNotifications();
              setNotificationState(prev => ({ ...prev, scheduledCount: notifs.length }));
              addLog(`${notifs.length} notifications programmées`);
              console.log('Scheduled:', notifs);
            }}>
              <Text style={styles.buttonText}>Lister programmées</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStop]} onPress={async () => {
              const ns = getNotificationService();
              await ns.cancelAllNotifications();
              setNotificationState(prev => ({ ...prev, scheduledCount: 0 }));
              addLog('Toutes notifications annulées');
            }}>
              <Text style={styles.buttonText}>Annuler toutes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSimulate]} onPress={async () => {
              const ns = getNotificationService();
              await ns.presentLocalNotification({
                title: '🔔 Test notification',
                body: 'Ceci est une notification de test locale',
                data: { test: true, timestamp: Date.now() },
                sound: 'default',
              });
              addLog('Notification locale envoyée');
            }}>
              <Text style={styles.buttonText}>Test local</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={async () => {
              const ns = getNotificationService();
              const wakeTime = Date.now() + 2 * 60 * 1000;
              await ns.scheduleAlarmNotification({
                id: 'test_alarm',
                label: 'Test 2min',
                wakeWindowStart: new Date(wakeTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                wakeWindowEnd: new Date(wakeTime + 90 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                days: [0,1,2,3,4,5,6],
                enabled: true,
                soundId: 'birds',
                volume: 0.7,
                lightEnabled: false,
                vibrationEnabled: true,
                snoozeEnabled: true,
                snoozeDuration: 10,
              }, wakeTime, wakeTime, 'Test manuel');
              addLog('Alarme test programmée dans 2min');
            }}>
              <Text style={styles.buttonText}>Test alarme (2min)</Text>
            </TouchableOpacity>
          </View>

          {notificationState.preferences && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Préférences :</Text>
              {Object.entries(notificationState.preferences).map(([k, v]) => (
                <Text key={k} style={styles.reasoningItem}>{k}: {v ? '✅' : '❌'}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>I18nService Test</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Initialisé</Text>
              <Text style={styles.metricValue}>{i18nState.initialized ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Locale actuelle</Text>
              <Text style={styles.metricValue}>{i18nState.currentLocale}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RTL</Text>
              <Text style={styles.metricValue}>{i18nState.isRTL ? '✅ OUI' : '❌ NON'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Locales supportées</Text>
              <Text style={styles.metricValue}>{i18nState.locales.length}</Text>
            </View>
          </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStart]} onPress={async () => {
              const i18n = getI18nService();
              await i18n.changeLocale('fr');
              setI18nState(prev => ({ ...prev, currentLocale: 'fr', isRTL: i18n.isRTL() }));
              addLog('Locale changée: fr');
            }}>
              <Text style={styles.buttonText}>Français</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSecondary]} onPress={async () => {
              const i18n = getI18nService();
              await i18n.changeLocale('en');
              setI18nState(prev => ({ ...prev, currentLocale: 'en', isRTL: i18n.isRTL() }));
              addLog('Locale changée: en');
            }}>
              <Text style={styles.buttonText}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={async () => {
              const i18n = getI18nService();
              await i18n.changeLocale('es');
              setI18nState(prev => ({ ...prev, currentLocale: 'es', isRTL: i18n.isRTL() }));
              addLog('Locale changée: es');
            }}>
              <Text style={styles.buttonText}>Español</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonSimulate]} onPress={async () => {
              const i18n = getI18nService();
              await i18n.changeLocale('de');
              setI18nState(prev => ({ ...prev, currentLocale: 'de', isRTL: i18n.isRTL() }));
              addLog('Locale changée: de');
            }}>
              <Text style={styles.buttonText}>Deutsch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonStop]} onPress={async () => {
              const i18n = getI18nService();
              addLog('Test traductions:');
              addLog(`  common.ok: ${i18n.tCommon('ok')}`);
              addLog(`  home.nextAlarm: ${i18n.tHome('nextAlarm')}`);
              addLog(`  alarm.smartWake: ${i18n.tAlarm('smartWake')}`);
              addLog(`  sleep.sleepAnalysis: ${i18n.tSleep('sleepAnalysis')}`);
              addLog(`  settings.title: ${i18n.tSettings('title')}`);
              addLog(`  notifications.alarm: ${i18n.tNotifications('alarm')}`);
              addLog(`  sounds.birds: ${i18n.tSounds('birds')}`);
              addLog(`  lights.wakeUpLight: ${i18n.tLights('wakeUpLight')}`);
              addLog(`  profile.chronotype: ${i18n.tProfile('chronotype')}`);
              addLog(`  onboarding.welcome: ${i18n.tOnboarding('welcome')}`);
              addLog(`  errors.generic: ${i18n.tErrors('generic')}`);
            }}>
              <Text style={styles.buttonText}>Test traductions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSmall, styles.buttonExport]} onPress={async () => {
              const i18n = getI18nService();
              const now = new Date();
              addLog(`Format date: ${i18n.formatDate(now)}`);
              addLog(`Format time: ${i18n.formatTime(now)}`);
              addLog(`Format dateTime: ${i18n.formatDateTime(now)}`);
              addLog(`Format duration 7.5h: ${i18n.formatDuration(7.5 * 3600000)}`);
            }}>
              <Text style={styles.buttonText}>Test formatage</Text>
            </TouchableOpacity>
          </View>

          {i18nState.locales.length > 0 && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningTitle}>Locales supportées :</Text>
              {i18nState.locales.map((loc, i) => (
                <Text key={i} style={styles.reasoningItem}>{loc} ({loc === i18nState.currentLocale ? 'ACTUELLE' : ''})</Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 14, color: '#8b9cb3', marginTop: 4 },
  card: { backgroundColor: '#131a2e', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  cardTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordingStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  indicator: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1e293b' },
  indicatorActive: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  timer: { fontSize: 24, fontWeight: '700', color: '#0ea5e9', fontFamily: 'monospace', marginLeft: 'auto' },
  buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { flex: 1, minWidth: 100, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  buttonStart: { backgroundColor: '#22c55e' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonExport: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  buttonSimulate: { backgroundColor: '#7c3aed' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flex: 1, minWidth: '30%', backgroundColor: '#0a0e1a', borderRadius: 8, padding: 12, alignItems: 'center' },
  metricLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'monospace', textAlign: 'center' },
  chart: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginBottom: 8 },
  bar: { flex: 1, borderRadius: 1, minHeight: 2 },
  chartHint: { fontSize: 11, color: '#64748b', textAlign: 'center' },
  logs: { maxHeight: 200, backgroundColor: '#0a0e1a', borderRadius: 8, padding: 12 },
  logLine: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 },
  alarmItem: { backgroundColor: '#0a0e1a', borderRadius: 8, padding: 12, marginTop: 8 },
  alarmItemLabel: { fontSize: 13, color: '#e2e8f0', marginBottom: 8 },
  alarmItemActions: { flexDirection: 'row', gap: 8 },
  buttonSmall: { paddingVertical: 8, minWidth: 80 },
  buttonSecondary: { backgroundColor: '#7c3aed' },
  reasoning: { marginTop: 12, padding: 12, backgroundColor: '#0a0e1a', borderRadius: 8 },
  reasoningTitle: { fontSize: 13, fontWeight: '600', color: '#e2e8f0', marginBottom: 8 },
  reasoningItem: { fontSize: 12, color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' },
});