import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Accelerometer, AccelerometerListener, setUpdateIntervalForType, SensorType } from 'expo-sensors';
import { SleepAnalyzer, AudioFeatures, AccelFeatures, SleepEpochFeatures } from '@/modules/sleep-analysis';

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

  const analyzerRef = useRef<SleepAnalyzer>(new SleepAnalyzer());
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
});