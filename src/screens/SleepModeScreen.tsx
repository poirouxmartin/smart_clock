import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useI18n } from '@/modules/i18n';
import { getSoundManager } from '@/modules/sound-manager';
import { getAlarmEngine } from '@/modules/alarm-engine';
import { getUserProfileManager } from '@/modules/user-profile';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { SleepSession, AlarmConfig } from '@/types';

const { width } = Dimensions.get('window');

const SLEEP_SOUNDS = [
  { id: 'rain', icon: 'rainy-outline' as const, color: '#38bdf8', label: 'Pluie' },
  { id: 'thunder', icon: 'thunderstorm-outline' as const, color: '#a78bfa', label: 'Tempête' },
  { id: 'wind', icon: 'leaf-outline' as const, color: '#6ee7b7', label: 'Vent' },
  { id: 'waves', icon: 'water-outline' as const, color: '#22d3ee', label: 'Vagues' },
  { id: 'forest', icon: 'forest-outline' as const, color: '#34d399', label: 'Forêt' },
  { id: 'stream', icon: 'flower-outline' as const, color: '#67e8f9', label: 'Ruisseau' },
  { id: 'crickets', icon: 'bug-outline' as const, color: '#fbbf24', label: 'Grillons' },
  { id: 'birds', icon: 'musical-notes-outline' as const, color: '#f472b6', label: 'Oiseaux' },
];

export function SleepModeScreen() {
  const navigation = useNavigation();

  const [selectedSound, setSelectedSound] = useState<string | null>('rain');
  const [volume, setVolume] = useState(0.6);
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [previewingSound, setPreviewingSound] = useState<string | null>(null);
  const [currentAlarm, setCurrentAlarm] = useState<AlarmConfig | null>(null);

  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const alarms = getAlarmEngine().getEnabledAlarms();
    if (alarms.length > 0) {
      setCurrentAlarm(alarms[0]);
    }
  }, []);

  useEffect(() => {
    if (isSleeping) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSleeping, pulseAnim]);

  useEffect(() => {
    if (isSleeping && sleepStartTime) {
      sleepIntervalRef.current = setInterval(() => {
        setElapsed(Date.now() - sleepStartTime);
      }, 1000);
    }
    return () => {
      if (sleepIntervalRef.current) {
        clearInterval(sleepIntervalRef.current);
        sleepIntervalRef.current = null;
      }
    };
  }, [isSleeping, sleepStartTime]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    };
  }, []);

  const stopPreview = useCallback(async () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    if (previewingSound) {
      try {
        await getSoundManager().stop(300);
      } catch (e) {
        console.error('Stop preview error:', e);
      }
      setPreviewingSound(null);
    }
  }, [previewingSound]);

  const handleSoundTap = useCallback(async (soundId: string) => {
    if (isSleeping) return;

    if (previewingSound === soundId) {
      await stopPreview();
      return;
    }

    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    try {
      await getSoundManager().stop(200);
    } catch (e) {
      console.error('Stop previous sound error:', e);
    }

    setSelectedSound(soundId);
    setPreviewingSound(soundId);

    try {
      await getSoundManager().play(soundId, { volume: 0.5 });
      previewTimeoutRef.current = setTimeout(async () => {
        try {
          await getSoundManager().stop(500);
        } catch (e) {
          console.error('Stop preview timeout error:', e);
        }
        setPreviewingSound(null);
        previewTimeoutRef.current = null;
        previewIntervalRef.current = null;
      }, 3000);
    } catch (e) {
      console.error('Preview sound error:', e);
      setPreviewingSound(null);
    }
  }, [isSleeping, previewingSound, stopPreview]);

  const startSleep = useCallback(async () => {
    if (!selectedSound) return;

    await stopPreview();

    try {
      const manager = getSoundManager();
      await manager.play(selectedSound, { volume, loop: true, fadeInDuration: 60000 });
      const now = Date.now();
      setIsSleeping(true);
      setSleepStartTime(now);
      setElapsed(0);
    } catch (e) {
      console.error('Start sleep sound error:', e);
    }
  }, [selectedSound, volume, stopPreview]);

  const stopSleep = useCallback(async () => {
    try {
      await getSoundManager().stop(5000);
    } catch (e) {
      console.error('Stop sleep sound error:', e);
    }

    if (sleepIntervalRef.current) {
      clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = null;
    }

    const endTime = Date.now();
    const startTime = sleepStartTime || endTime;

    if (currentAlarm) {
      const today = new Date();
      const [startH, startM] = currentAlarm.wakeWindowStart.split(':').map(Number);
      const [endH, endM] = currentAlarm.wakeWindowEnd.split(':').map(Number);

      const wakeStart = new Date(today);
      wakeStart.setHours(startH, startM, 0, 0);
      if (wakeStart.getTime() <= startTime) {
        wakeStart.setDate(wakeStart.getDate() + 1);
      }

      const wakeEnd = new Date(today);
      wakeEnd.setHours(endH, endM, 0, 0);
      if (wakeEnd.getTime() <= wakeStart.getTime()) {
        wakeEnd.setDate(wakeEnd.getDate() + 1);
      }

      const totalSleep = endTime - startTime;
      const session: SleepSession = {
        id: `sleep_${Date.now()}`,
        userId: 'current_user',
        startTime,
        endTime,
        targetWakeWindow: { start: wakeStart.getTime(), end: wakeEnd.getTime() },
        totalSleepTime: totalSleep,
        sleepEfficiency: 85,
        cyclesCount: Math.floor(totalSleep / (90 * 60 * 1000)),
        createdAt: startTime,
        updatedAt: endTime,
      };

      try {
        await getDatabaseService().saveSleepSession(session);
      } catch (e) {
        console.error('Save sleep session error:', e);
      }
    }

    setIsSleeping(false);
    setSleepStartTime(null);
    setElapsed(0);
  }, [sleepStartTime, currentAlarm]);

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatWakeTime = (timeStr: string) => {
    return timeStr;
  };

  return (
    <LinearGradient colors={['#1e1b4b', '#0f172a', '#0a0e1a']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <Ionicons name="moon" size={48} color={Colors.accent} />
            </Animated.View>
            <Text style={styles.title}>Mode Sommeil</Text>
            <Text style={styles.subtitle}>Fermez les yeux et laissez le son vous guider</Text>
          </View>

          {isSleeping && (
            <View style={styles.sleepingCard}>
              <View style={styles.sleepingIndicator}>
                <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
                <Text style={styles.sleepingLabel}>Suivi en cours...</Text>
              </View>
              <Text style={styles.elapsedTime}>{formatTime(elapsed)}</Text>
              <Text style={styles.elapsedLabel}>temps écoulé</Text>
            </View>
          )}

          {previewingSound && (
            <View style={styles.previewBadge}>
              <Ionicons name="volume-high" size={14} color={Colors.primary} />
              <Text style={styles.previewText}>Aperçu en cours</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Choisir un son</Text>
          <View style={styles.soundsGrid}>
            {SLEEP_SOUNDS.map(sound => (
              <TouchableOpacity
                key={sound.id}
                style={[
                  styles.soundCard,
                  selectedSound === sound.id && styles.soundCardActive,
                  selectedSound === sound.id && { borderColor: sound.color },
                ]}
                onPress={() => handleSoundTap(sound.id)}
              >
                <View style={[styles.soundIcon, { backgroundColor: sound.color + '20' }]}>
                  <Ionicons name={sound.icon} size={28} color={sound.color} />
                </View>
                <Text style={styles.soundLabel}>{sound.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Volume</Text>
          <View style={styles.volumeContainer}>
            <Ionicons name="volume-low" size={20} color={Colors.textMuted} />
            <View style={styles.volumeTrack}>
              <TouchableOpacity
                style={[styles.volumeFill, { width: `${volume * 100}%` }]}
                activeOpacity={1}
              />
              <TouchableOpacity
                style={[styles.volumeThumb, { left: `${volume * 100}%` }]}
                onPress={() => {}}
              />
            </View>
            <Ionicons name="volume-high" size={20} color={Colors.textMuted} />
          </View>

          <TouchableOpacity
            style={styles.volumeSlider}
            onPress={() => {
              const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
              const idx = levels.findIndex(v => Math.abs(v - volume) < 0.1);
              setVolume(levels[(idx + 1) % levels.length]);
            }}
          >
            <Text style={styles.volumePercent}>{Math.round(volume * 100)}%</Text>
          </TouchableOpacity>

          {!isSleeping && (
            <TouchableOpacity
              style={styles.playButton}
              onPress={startSleep}
            >
              <LinearGradient
                colors={['#0ea5e9', '#7c3aed']}
                style={styles.playButtonGradient}
              >
                <Ionicons name="play" size={32} color="#fff" />
                <Text style={styles.playButtonText}>Commencer le sommeil</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isSleeping && (
            <TouchableOpacity
              style={styles.playButton}
              onPress={stopSleep}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.playButtonGradient}
              >
                <Ionicons name="stop" size={32} color="#fff" />
                <Text style={styles.playButtonText}>Arrêter le suivi</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {currentAlarm && (
            <View style={styles.wakeWindowCard}>
              <Ionicons name="alarm-outline" size={20} color={Colors.accent} />
              <View style={styles.wakeWindowInfo}>
                <Text style={styles.wakeWindowLabel}>Fenêtre de réveil</Text>
                <Text style={styles.wakeWindowTime}>
                  {formatWakeTime(currentAlarm.wakeWindowStart)} — {formatWakeTime(currentAlarm.wakeWindowEnd)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  title: { ...Typography.h1, marginTop: Spacing.md, textAlign: 'center' },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },

  sleepingCard: { alignItems: 'center', marginBottom: Spacing.xxxl, padding: Spacing.xl, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.accent + '40' },
  sleepingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  sleepingLabel: { ...Typography.bodySmall, color: Colors.accent, fontWeight: '600' },
  elapsedTime: { fontSize: 48, fontWeight: '200', color: Colors.accent, fontVariant: ['tabular-nums'] },
  elapsedLabel: { ...Typography.caption, marginTop: Spacing.xs },

  previewBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: Colors.primary + '20', borderRadius: Radius.full, marginBottom: Spacing.md },
  previewText: { ...Typography.caption, color: Colors.primary },

  sectionTitle: { ...Typography.label, marginBottom: Spacing.md, marginTop: Spacing.lg },

  soundsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  soundCard: { width: (width - Spacing.xxl * 2 - Spacing.md) / 4, aspectRatio: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm },
  soundCardActive: { backgroundColor: Colors.bgCardAlt },
  soundIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  soundLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  volumeContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  volumeTrack: { flex: 1, height: 4, backgroundColor: Colors.bgSurface, borderRadius: 2, position: 'relative' },
  volumeFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  volumeThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, position: 'absolute', top: -8, marginLeft: -10 },
  volumeSlider: { alignItems: 'center', marginTop: Spacing.sm },
  volumePercent: { ...Typography.bodySmall, color: Colors.primary },

  playButton: { marginTop: Spacing.xl, borderRadius: Radius.xl, overflow: 'hidden' },
  playButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: Spacing.md },
  playButtonText: { ...Typography.h3, color: '#fff' },

  wakeWindowCard: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xl, padding: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border },
  wakeWindowInfo: { marginLeft: Spacing.md },
  wakeWindowLabel: { ...Typography.caption, marginBottom: Spacing.xs },
  wakeWindowTime: { ...Typography.body, color: Colors.text, fontWeight: '600' },
});
