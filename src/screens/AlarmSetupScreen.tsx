import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TimePickerAndroid, Platform, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList, AlarmConfig } from '@/types';

type AlarmSetupNav = React.NavigationProp<RootStackParamList, 'AlarmSetup'>;
type AlarmSetupRoute = React.RouteProp<RootStackParamList, 'AlarmSetup'>;

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function AlarmSetupScreen() {
  const navigation = useNavigation<AlarmSetupNav>();
  const route = useRoute<AlarmSetupRoute>();
  const isEditing = !!route.params?.alarmId;

  const [wakeStart, setWakeStart] = useState('06:30');
  const [wakeEnd, setWakeEnd] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [soundId, setSoundId] = useState('birds');
  const [volume, setVolume] = useState(0.7);
  const [lightEnabled, setLightEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);

  const pickTime = async (setter: (t: string) => void) => {
    if (Platform.OS === 'android') {
      const [h, m] = setter === setWakeStart ? wakeStart.split(':') : wakeEnd.split(':');
      try {
        const { action, hour, minute } = await TimePickerAndroid.open({
          hour: parseInt(h, 10),
          minute: parseInt(m, 10),
          is24Hour: true,
        });
        if (action === TimePickerAndroid.timeSetAction) {
          setter(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        }
      } catch (e) {
        console.warn('TimePicker error', e);
      }
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const save = () => {
    const alarm: AlarmConfig = {
      id: route.params?.alarmId || Date.now().toString(),
      label: `Réveil ${wakeStart} - ${wakeEnd}`,
      wakeWindowStart: wakeStart,
      wakeWindowEnd: wakeEnd,
      days: selectedDays,
      enabled: true,
      soundId,
      volume,
      lightEnabled,
      vibrationEnabled,
      snoozeEnabled,
      snoozeDuration: 10,
    };
    console.log('Save alarm:', alarm);
    Alert.alert('Sauvegardé', 'Réveil configuré (persistance TODO)');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Modifier' : 'Nouveau'} réveil</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fenêtre de réveil (1h30)</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity style={styles.timeBox} onPress={() => pickTime(setWakeStart)}>
              <Text style={styles.timeLabel}>Début</Text>
              <Text style={styles.timeValue}>{wakeStart}</Text>
            </TouchableOpacity>
            <Text style={styles.timeSeparator}>→</Text>
            <TouchableOpacity style={styles.timeBox} onPress={() => pickTime(setWakeEnd)}>
              <Text style={styles.timeLabel}>Fin</Text>
              <Text style={styles.timeValue}>{wakeEnd}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>L\'app vous réveillera au moment optimal dans cette fenêtre</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jours</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selectedDays.includes(i) && styles.dayButtonActive]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[styles.dayText, selectedDays.includes(i) && styles.dayTextActive]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son de réveil</Text>
          <View style={styles.soundList}>
            {['birds', 'waves', 'rain', 'forest', 'stream'].map(id => (
              <TouchableOpacity
                key={id}
                style={[styles.soundItem, soundId === id && styles.soundItemActive]}
                onPress={() => setSoundId(id)}
              >
                <Text style={[styles.soundName, soundId === id && styles.soundNameActive]}>{id.charAt(0).toUpperCase() + id.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.volumeIcon}>🔈</Text>
            <View style={styles.slider}>
              <View style={{ width: `${volume * 100}%`, height: '100%', backgroundColor: '#0ea5e9', borderRadius: 2 }} />
            </View>
            <Text style={styles.volumeIcon}>🔊</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options</Text>
          <View style={styles.toggleRow}>
            <Text>Lumière progressive</Text>
            <TouchableOpacity style={[styles.toggle, lightEnabled && styles.toggleActive]} onPress={() => setLightEnabled(!lightEnabled)}>
              <View style={[styles.toggleThumb, lightEnabled && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
          <View style={styles.toggleRow}>
            <Text>Vibration</Text>
            <TouchableOpacity style={[styles.toggle, vibrationEnabled && styles.toggleActive]} onPress={() => setVibrationEnabled(!vibrationEnabled)}>
              <View style={[styles.toggleThumb, vibrationEnabled && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
          <View style={styles.toggleRow}>
            <Text>Snooze (10min)</Text>
            <TouchableOpacity style={[styles.toggle, snoozeEnabled && styles.toggleActive]} onPress={() => setSnoozeEnabled(!snoozeEnabled)}>
              <View style={[styles.toggleThumb, snoozeEnabled && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Enregistrer' : 'Créer le réveil'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backText: { color: '#8b9cb3', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '600', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBox: { flex: 1, padding: 16, backgroundColor: '#131a2e', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  timeLabel: { fontSize: 12, color: '#8b9cb3', marginBottom: 4 },
  timeValue: { fontSize: 28, fontWeight: '600', color: '#fff' },
  timeSeparator: { fontSize: 24, color: '#64748b' },
  helpText: { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#131a2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' },
  dayButtonActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#8b9cb3' },
  dayTextActive: { color: '#fff' },
  soundList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundItem: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#131a2e', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b' },
  soundItemActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  soundName: { fontSize: 14, color: '#e2e8f0' },
  soundNameActive: { color: '#fff', fontWeight: '600' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slider: { flex: 1, height: 4, backgroundColor: '#1e293b', borderRadius: 2 },
  volumeIcon: { fontSize: 20 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  toggle: { width: 52, height: 28, borderRadius: 14, backgroundColor: '#1e293b', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: '#0ea5e9' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  toggleThumbActive: { marginLeft: 24 },
  saveButton: { marginTop: 16, paddingVertical: 16, backgroundColor: '#0ea5e9', borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});