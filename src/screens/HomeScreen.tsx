import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/types';

type HomeNav = React.NavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const now = new Date();
  const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.time}>{timeString}</Text>
          <Text style={styles.date}>{dateString}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prochain réveil</Text>
          <Text style={styles.nextAlarm}>6:30 - 8:00</Text>
          <Text style={styles.alarmSubtitle}>Fenêtre intelligente 1h30</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Indicateur coucher</Text>
          <Text style={styles.bedtime}>22:45</Text>
          <Text style={styles.bedtimeSubtitle}>Pour 6 cycles complets (9h)</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => navigation.navigate('AlarmSetup')}
          >
            <Text style={styles.buttonText}>Nouveau réveil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => navigation.navigate('SleepAnalysis')}
          >
            <Text style={styles.buttonText}>Analyse sommeil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dernière nuit</Text>
          <View style={styles.sleepSummary}>
            <Text style={styles.summaryItem}>
              <Text style={styles.summaryValue}>7h 23m</Text>
              <Text style={styles.summaryLabel}>Durée</Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.summaryValue}>85%</Text>
              <Text style={styles.summaryLabel}>Qualité</Text>
            </Text>
            <Text style={styles.summaryItem}>
              <Text style={styles.summaryValue}>5</Text>
              <Text style={styles.summaryLabel}>Cycles</Text>
            </Text>
          </View>
        </View>

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={() => navigation.navigate('DevTools')}
          >
            <Text style={styles.devButtonText}>🛠 Outils développeur</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsButtonText}>⚙️ Paramètres</Text>
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
  bedtime: { fontSize: 36, fontWeight: '600', color: '#22d3ee' },
  bedtimeSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  button: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#0ea5e9' },
  buttonSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sleepSummary: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 12, color: '#8b9cb3', marginTop: 2 },
  devButton: { marginTop: 20, padding: 12, backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center' },
  devButtonText: { color: '#64748b', fontSize: 13 },
  settingsButton: { position: 'absolute', bottom: 30, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  settingsButtonText: { color: '#64748b', fontSize: 14 },
});