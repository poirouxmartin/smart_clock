import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Accelerometer, AccelerometerListener, setUpdateIntervalForType, SensorType } from 'expo-sensors';

export function DevToolsScreen() {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [accelData, setAccelData] = useState<{x: number; y: number; z: number} | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const accelSubRef = useRef<AccelerometerListener | null>(null);
  const chunkRef = useRef<number[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    setUpdateIntervalForType(SensorType.accelerometer, 100);
    accelSubRef.current = Accelerometer.addListener(data => {
      setAccelData(data);
      chunkRef.current.push(Math.sqrt(data.x**2 + data.y**2 + data.z**2));
    });
    return () => {
      accelSubRef.current?.remove();
      timerRef.current && clearInterval(timerRef.current);
    };
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
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await rec.startAsync();
      recordingRef.current = rec;
      setRecording(true);
      setRecordingTime(0);
      setAudioData([]);
      chunkRef.current = [];
      addLog('Enregistrement démarré');

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
        if (chunkRef.current.length > 0) {
          const rms = Math.sqrt(chunkRef.current.reduce((a, b) => a + b**2, 0) / chunkRef.current.length);
          setAudioData(prev => [...prev.slice(-299), rms]);
          chunkRef.current = [];
        }
      }, 1000);

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
      
      // Export data
      const csv = audioData.map((v, i) => `${i},${v.toFixed(6)}`).join('\n');
      addLog(`Données: ${audioData.length} échantillons RMS`);
      console.log('CSV Export:\n', csv);
      
    } catch (e) {
      addLog(`Erreur stop: ${e}`);
    }
  };

  const exportCSV = () => {
    const csv = 'timestamp,rms,accel_mag\n' + 
      audioData.map((v, i) => `${i * 1000},${v.toFixed(6)},0`).join('\n');
    addLog('CSV prêt (voir console)');
    console.log('=== EXPORT CSV ===\n', csv);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🛠 Outils Développeur</Text>
          <Text style={styles.subtitle}>POC Analyse Microphone + Accéléromètre</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enregistrement Audio</Text>
          <View style={styles.recordingStatus}>
            <View style={[styles.indicator, recording && styles.indicatorActive]} />
            <Text style={styles.statusText}>{recording ? '🔴 ENREGISTREMENT' : '⚪ ARRÊT'}</Text>
            <Text style={styles.timer}>{Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2,'0')}</Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, recording ? styles.buttonStop : styles.buttonStart]} 
              onPress={recording ? stopRecording : startRecording}
              disabled={false}
            >
              <Text style={styles.buttonText}>{recording ? 'Arrêter' : 'Démarrer (30s/chunk)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonExport]} onPress={exportCSV}>
              <Text style={styles.buttonText}>Exporter CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Métriques Temps Réel</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>RMS Audio</Text>
              <Text style={styles.metricValue}>{audioData[audioData.length-1]?.toFixed(6) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Échantillons</Text>
              <Text style={styles.metricValue}>{audioData.length}s</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Accel X</Text>
              <Text style={styles.metricValue}>{accelData?.x.toFixed(3) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Accel Y</Text>
              <Text style={styles.metricValue}>{accelData?.y.toFixed(3) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Accel Z</Text>
              <Text style={styles.metricValue}>{accelData?.z.toFixed(3) || '0'}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Magnitude</Text>
              <Text style={styles.metricValue}>{accelData ? Math.sqrt(accelData.x**2+accelData.y**2+accelData.z**2).toFixed(3) : '0'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Graphique RMS (derniers 5min)</Text>
          <View style={styles.chart}>
            {audioData.slice(-300).map((v, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: Math.min(Math.max(v * 2000, 2), 100) }
                ]}
              />
            ))}
          </View>
          <Text style={styles.chartHint}>Seuil détection mouvement ~0.01-0.05 RMS</Text>
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
          <Text style={styles.cardTitle}>Prochaines étapes POC</Text>
          <Text style={styles.todo}>
            1. Détection pics RMS → marqueurs mouvement\n
            2. Analyse spectrale (FFT) pour ronflements/respiration\n
            3. Fusion accel + audio → score phase légère\n
            4. Fenêtre glissante 5min → déclencheur réveil\n
            5. Test nuit complète + export CSV → analyse Python
          </Text>
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
  indicatorActive: { backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' },
  statusText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  timer: { fontSize: 24, fontWeight: '700', color: '#0ea5e9', fontFamily: 'monospace', marginLeft: 'auto' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  buttonStart: { backgroundColor: '#22c55e' },
  buttonStop: { backgroundColor: '#ef4444' },
  buttonExport: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flex: 1, minWidth: '30%', backgroundColor: '#0a0e1a', borderRadius: 8, padding: 12, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 4, fontFamily: 'monospace' },
  chart: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginBottom: 8 },
  bar: { flex: 1, backgroundColor: '#0ea5e9', borderRadius: 1, minHeight: 2 },
  chartHint: { fontSize: 11, color: '#64748b', textAlign: 'center' },
  logs: { maxHeight: 200, backgroundColor: '#0a0e1a', borderRadius: 8, padding: 12 },
  logLine: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 2 },
  todo: { fontSize: 12, color: '#94a3b8', lineHeight: 20, fontFamily: 'monospace' },
});