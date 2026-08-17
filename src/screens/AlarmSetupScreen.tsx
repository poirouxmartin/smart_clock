import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TimePickerAndroid, Platform, Alert, Switch } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getAlarmEngine } from '@/modules/alarm-engine';
import { getUserProfileManager } from '@/modules/user-profile';
import { getSoundManager } from '@/modules/sound-manager';
import type { RootStackParamList, AlarmConfig } from '@/types';

type AlarmSetupNav = React.NavigationProp<RootStackParamList, 'AlarmSetup'>;
type AlarmSetupRoute = React.RouteProp<RootStackParamList, 'AlarmSetup'>;

export function AlarmSetupScreen() {
  const navigation = useNavigation<AlarmSetupNav>();
  const route = useRoute<AlarmSetupRoute>();
  const { t, tAlarm, tCommon, tSounds } = useI18n();
  const isEditing = !!route.params?.alarmId;

  const [wakeStart, setWakeStart] = useState('06:30');
  const [wakeEnd, setWakeEnd] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [soundId, setSoundId] = useState('birds');
  const [volume, setVolume] = useState(0.7);
  const [lightEnabled, setLightEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);
  const [snoozeDuration, setSnoozeDuration] = useState(10);
  const [sounds, setSounds] = useState<Array<{id: string; name: string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const profileManager = getUserProfileManager();
      const profile = profileManager.getProfile();
      const soundManager = getSoundManager();
      
      if (profile) {
        setWakeStart(profile.typicalWakeTime || '06:30');
        const wakeDate = new Date();
        const [h, m] = (profile.typicalWakeTime || '06:30').split(':').map(Number);
        wakeDate.setHours(h, m + 90, 0, 0);
        setWakeEnd(wakeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        setSelectedDays([0,1,2,3,4,5,6]);
        setVolume(profile.defaultVolume);
        setLightEnabled(profile.lightEnabled);
        setVibrationEnabled(profile.vibrationEnabled);
        setSnoozeEnabled(profile.snoozeEnabled);
        setSnoozeDuration(profile.snoozeDuration / 60000);
      }
      
      const allSounds = soundManager.getAllSounds();
      setSounds(allSounds.map(s => ({ id: s.id, name: s.name })));
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isEditing && route.params?.alarmId) {
      // Load existing alarm data
      const alarmEngine = getAlarmEngine();
      const alarms = alarmEngine.getEnabledAlarms();
      const alarm = alarms.find(a => a.id === route.params?.alarmId);
      if (alarm) {
        setWakeStart(alarm.wakeWindowStart);
        setWakeEnd(alarm.wakeWindowEnd);
        setSelectedDays(alarm.days);
        setSoundId(alarm.soundId);
        setVolume(alarm.volume);
        setLightEnabled(alarm.lightEnabled);
        setVibrationEnabled(alarm.vibrationEnabled);
        setSnoozeEnabled(alarm.snoozeEnabled);
        setSnoozeDuration(alarm.snoozeDuration / 60000);
      }
    }
  }, [isEditing, route.params?.alarmId]);

  const pickTime = useCallback(async (setter: (t: string) => void, current: string) => {
    if (Platform.OS === 'android') {
      const [h, m] = current.split(':');
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
  }, []);

  const toggleDay = useCallback((day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  }, []);

  const validateWindow = useCallback(() => {
    const start = new Date(`2000-01-01T${wakeStart}:00`);
    const end = new Date(`2000-01-01T${wakeEnd}:00`);
    const diff = (end.getTime() - start.getTime()) / 60000;
    return diff >= 30 && diff <= 180;
  }, [wakeStart, wakeEnd]);

  const save = useCallback(async () => {
    if (!validateWindow()) {
      Alert.alert(tCommon('error'), 'La fenêtre doit être entre 30min et 3h');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert(tCommon('error'), tAlarm('days') + ' : ' + tCommon('error'));
      return;
    }

    const alarm: AlarmConfig = {
      id: route.params?.alarmId || Date.now().toString(),
      label: `${tAlarm('newAlarm')} ${wakeStart} - ${wakeEnd}`,
      wakeWindowStart: wakeStart,
      wakeWindowEnd: wakeEnd,
      days: selectedDays,
      enabled: true,
      soundId,
      volume,
      lightEnabled,
      vibrationEnabled,
      snoozeEnabled,
      snoozeDuration,
    };

    const alarmEngine = getAlarmEngine();
    if (isEditing) {
      alarmEngine.updateAlarm(alarm);
    } else {
      alarmEngine.addAlarm(alarm);
    }

    Alert.alert(tCommon('save'), isEditing ? tAlarm('enabled') : tCommon('save') + ' !');
    navigation.goBack();
  }, [isEditing, route.params?.alarmId, wakeStart, wakeEnd, selectedDays, soundId, volume, lightEnabled, vibrationEnabled, snoozeEnabled, snoozeDuration, navigation, validateWindow]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const DAYS = [tCommon('sunday'), tCommon('monday'), tCommon('tuesday'), tCommon('wednesday'), tCommon('thursday'), tCommon('friday'), tCommon('saturday')];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{tCommon('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? tCommon('edit') : tCommon('add')} {tAlarm('title').toLowerCase()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tAlarm('wakeWindow')} (1h30)</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity style={styles.timeBox} onPress={() => pickTime(setWakeStart, wakeStart)}>
              <Text style={styles.timeLabel}>{tAlarm('wakeWindowStart')}</Text>
              <Text style={styles.timeValue}>{wakeStart}</Text>
            </TouchableOpacity>
            <Text style={styles.timeSeparator}>→</Text>
            <TouchableOpacity style={styles.timeBox} onPress={() => pickTime(setWakeEnd, wakeEnd)}>
              <Text style={styles.timeLabel}>{tAlarm('wakeWindowEnd')}</Text>
              <Text style={styles.timeValue}>{wakeEnd}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>{tAlarm('smartWake')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tAlarm('days')}</Text>
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
          <Text style={styles.sectionTitle}>{tAlarm('sound')}</Text>
          <View style={styles.soundList}>
            {sounds.map(sound => (
              <TouchableOpacity
                key={sound.id}
                style={[styles.soundItem, soundId === sound.id && styles.soundItemActive]}
                onPress={() => setSoundId(sound.id)}
              >
                <Text style={[styles.soundName, soundId === sound.id && styles.soundNameActive]}>{sound.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tAlarm('volume')}</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.volumeIcon}>🔈</Text>
            <View style={styles.slider}>
              <View style={{ width: `${volume * 100}%`, height: '100%', backgroundColor: '#0ea5e9', borderRadius: 2 }} />
            </View>
            <Text style={styles.volumeIcon}>🔊</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tCommon('settings')}</Text>
          <View style={styles.toggleRow}>
            <Text>{tAlarm('lightEnabled')}</Text>
            <Switch
              value={lightEnabled}
              onValueChange={setLightEnabled}
              trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleRow}>
            <Text>{tAlarm('vibrationEnabled')}</Text>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleRow}>
            <Text>{tAlarm('snoozeEnabled')} ({snoozeDuration}{tAlarm('minutes')})</Text>
            <Switch
              value={snoozeEnabled}
              onValueChange={setSnoozeEnabled}
              trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
              thumbColor="#fff"
            />
          </View>
          {snoozeEnabled && (
            <View style={styles.toggleRow}>
              <Text>{tAlarm('snoozeDuration')}</Text>
              <View style={styles.sliderRow}>
                <TouchableOpacity style={styles.sliderButton} onPress={() => setSnoozeDuration(Math.max(5, snoozeDuration - 5))}>
                  <Text style={styles.sliderButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.snoozeValue}>{snoozeDuration} {tAlarm('minutes')}</Text>
                <TouchableOpacity style={styles.sliderButton} onPress={() => setSnoozeDuration(Math.min(30, snoozeDuration + 5))}>
                  <Text style={styles.sliderButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={!validateWindow() || selectedDays.length === 0}>
          <Text style={styles.saveButtonText}>{isEditing ? tCommon('save') : tCommon('add') + ' ' + tAlarm('title')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b9cb3', fontSize: 16 },
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
  sliderButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  sliderButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  snoozeValue: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 60, textAlign: 'center' },
  saveButton: { marginTop: 16, paddingVertical: 16, backgroundColor: '#0ea5e9', borderRadius: 12, alignItems: 'center', opacity: 1 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});