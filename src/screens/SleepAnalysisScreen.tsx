import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/types';

type SleepAnalysisNav = React.NavigationProp<RootStackParamList, 'SleepAnalysis'>;

export function SleepAnalysisScreen() {
  const navigation = useNavigation<SleepAnalysisNav>();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const sessions = [
    { id: '1', date: '16/08/2026', duration: '7h 23m', quality: 85, cycles: 5, wakeTime: '07:12' },
    { id: '2', date: '15/08/2026', duration: '6h 45m', quality: 72, cycles: 4, wakeTime: '06:58' },
    { id: '3', date: '14/08/2026', duration: '8h 12m', quality: 91, cycles: 5, wakeTime: '07:45' },
    { id: '4', date: '13/08/2026', duration: '7h 05m', quality: 78, cycles: 4, wakeTime: '07:03' },
    { id: '5', date: '12/08/2026', duration: '6h 30m', quality: 65, cycles: 4, wakeTime: '06:45' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Analyse du sommeil</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>7h 15m</Text>
            <Text style={styles.statLabel}>Moyenne 7 jours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>82%</Text>
            <Text style={styles.statLabel}>Qualité moyenne</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Cycles/nuit</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12min</Text>
            <Text style={styles.statLabel}>Endormissement</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des nuits</Text>
          {sessions.map(session => (
            <TouchableOpacity
              key={session.id}
              style={[styles.sessionCard, selectedSession === session.id && styles.sessionCardActive]}
              onPress={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
            >
              <View style={styles.sessionMain}>
                <View>
                  <Text style={styles.sessionDate}>{session.date}</Text>
                  <Text style={styles.sessionWake}>Réveil: {session.wakeTime} • {session.duration}</Text>
                </View>
                <View style={styles.sessionQuality}>
                  <Text style={[styles.qualityScore, session.quality >= 80 && styles.qualityGood, session.quality < 70 && styles.qualityPoor]}>{session.quality}%</Text>
                </View>
              </View>
              {selectedSession === session.id && (
                <View style={styles.sessionDetail}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cycles complets</Text>
                    <Text style={styles.detailValue}>{session.cycles}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fenêtre réveil</Text>
                    <Text style={styles.detailValue}>06:30 - 08:00</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Réveil optimal détecté</Text>
                    <Text style={styles.detailValue}>07:12 (phase légère)</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Note ressenti</Text>
                    <Text style={styles.detailValue}>⭐⭐⭐⭐☆ Bien</Text>
                  </View>
                  <TouchableOpacity style={styles.rateButton}>
                    <Text style={styles.rateButtonText}>Noter ce réveil</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tendances</Text>
          <View style={styles.trendCard}>
            <Text style={styles.trendItem}>
              <Text style={styles.trendIcon}>📈</Text>
              <Text>Qualité en hausse +5% sur 7 jours</Text>
            </Text>
            <Text style={styles.trendItem}>
              <Text style={styles.trendIcon}>🕐</Text>
              <Text>Coucher plus régulier (écart 22min)</Text>
            </Text>
            <Text style={styles.trendItem}>
              <Text style={styles.trendIcon}>🌙</Text>
              <Text>Phase profonde stable ~22%</Text>
            </Text>
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
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#131a2e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 12, color: '#8b9cb3', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  sessionCard: { backgroundColor: '#131a2e', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  sessionCardActive: { borderColor: '#0ea5e9' },
  sessionMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { fontSize: 16, fontWeight: '600', color: '#fff' },
  sessionWake: { fontSize: 13, color: '#8b9cb3', marginTop: 2 },
  sessionQuality: { alignItems: 'flex-end' },
  qualityScore: { fontSize: 20, fontWeight: '700' },
  qualityGood: { color: '#22c55e' },
  qualityPoor: { color: '#ef4444' },
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