import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Accelerometer, AccelerometerListener, setUpdateIntervalForType, SensorType } from 'expo-sensors';
import { SleepAnalyzer, AudioFeatures, AccelFeatures, SleepEpochFeatures } from '@/modules/sleep-analysis';
import { AlarmEngine, createAlarmEngine, ActiveAlarm, AlarmConfig } from '@/modules/alarm-engine';
import { SoundManager, getSoundManager, PlaybackStatus } from '@/modules/sound-manager';

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

  const analyzerRef = useRef<SleepAnalyzer>(new SleepAnalyzer());
  const engineRef = useRef<AlarmEngine | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const accelSubRef = useRef<AccelerometerListener | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const samplesCollectedRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    setUpdateIntervalForType(SensorType.accelerometer, 100);
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
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await rec.startAsync();
      recordingRef.current = rec;
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

      const listener = rec.addListener((status) => {
        if (status.isRecording && status.bufferedSize) {
          const newSamples = status.bufferedSize;
          samplesCollectedRef.current += newSamples;
          
          if (samplesCollectedRef.current >= SAMPLES_PER_CHUNK) {
            samplesCollectedRef.current = 0;
            const chunk = new Float32Array(SAMPLES_PER_CHUNK);
            processAudioChunk(chunk);
          }
        }
      });

      return () => listener.remove();
    } catch (e) {
      addLog(`Erreur: ${e}`);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      timerRef.current && clearInterval(timerRef.current);
      const uri = await recordingRef.current.stopAndUnloadAsync();
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
          <Text style={styles.chartHint}>Vert = phase légère détectée (>60%) • Bleu = autre phase</Text>
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
});