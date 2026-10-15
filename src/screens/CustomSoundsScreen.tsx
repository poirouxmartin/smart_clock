import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getSoundManager } from '@/modules/sound-manager';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { RootStackParamList } from '@/types';

type CustomSoundsNav = React.NavigationProp<RootStackParamList, 'CustomSounds'>;

export function CustomSoundsScreen() {
  const navigation = useNavigation<CustomSoundsNav>();
  const { t, tCommon, tSounds } = useI18n();
  
  const [customSounds, setCustomSounds] = useState<Array<{id: string; name: string; uri: string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSounds = async () => {
      const soundManager = getSoundManager();
      const sounds = soundManager.getAllSounds('custom');
      setCustomSounds(sounds.map(s => ({ id: s.id, name: s.name, uri: s.uri })));
      setLoading(false);
    };
    loadSounds();
  }, []);

  const addCustomSound = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets[0]) return;
      
      const asset = result.assets[0];
      const name = asset.name?.replace(/\.[^/.]+$/, '') || 'Custom Sound';
      
      const soundManager = getSoundManager();
      soundManager.addCustomSound({
        id: `custom_${Date.now()}`,
        name,
        uri: asset.uri,
        type: 'custom',
        duration: 0,
        loopable: true,
        volume: 0.7,
      });
      
      const sounds = soundManager.getAllSounds('custom');
      setCustomSounds(sounds.map(s => ({ id: s.id, name: s.name, uri: s.uri })));
      
      Alert.alert(tCommon('ok'), tSounds('addCustom') + ' ' + tCommon('save'));
    } catch (e) {
      console.error('Add custom sound error:', e);
      Alert.alert(tCommon('error'), tSounds('importAudio') + ' ' + tCommon('tryAgain'));
    }
  }, []);

  const removeSound = useCallback(async (soundId: string) => {
    Alert.alert(
      tCommon('confirm'),
      tCommon('delete') + ' ?',
      [
        { text: tCommon('cancel'), style: 'cancel' },
        { 
          text: tCommon('delete'), 
          style: 'destructive', 
          onPress: () => {
            const soundManager = getSoundManager();
            soundManager.removeCustomSound(soundId);
            const sounds = soundManager.getAllSounds('custom');
            setCustomSounds(sounds.map(s => ({ id: s.id, name: s.name, uri: s.uri })));
          }
        }
      ]
    );
  }, []);

  const playSound = useCallback(async (soundId: string) => {
    const soundManager = getSoundManager();
    await soundManager.play(soundId, { volume: 0.7, fadeInDuration: 5000 });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{tCommon('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tSounds('customSounds')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tSounds('addCustom')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={addCustomSound}>
            <Text style={styles.addButtonText}>+ {tSounds('addCustom')}</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>{tSounds('importAudio')} (MP3, WAV, M4A)</Text>
        </View>

        {customSounds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{tSounds('customSounds')}</Text>
            <Text style={styles.emptySubtext}>{tCommon('noData')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{tCommon('sounds')} ({customSounds.length})</Text>
            {customSounds.map(sound => (
              <View key={sound.id} style={styles.soundRow}>
                <View style={styles.soundInfo}>
                  <Text style={styles.soundName}>{sound.name}</Text>
                  <Text style={styles.soundType}>{tSounds('customSounds')}</Text>
                </View>
                <View style={styles.soundActions}>
                  <TouchableOpacity style={[styles.actionButton, styles.playButton]} onPress={() => playSound(sound.id)}>
                    <Text style={styles.actionButtonText}>▶</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => removeSound(sound.id)}>
                    <Text style={styles.actionButtonText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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
  card: { backgroundColor: '#131a2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  cardTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  addButton: { backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  helpText: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#131a2e', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#8b9cb3' },
  soundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  soundInfo: { flex: 1 },
  soundName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  soundType: { fontSize: 13, color: '#8b9cb3' },
  soundActions: { flexDirection: 'row', gap: 12 },
  actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  playButton: { backgroundColor: '#0ea5e9' },
  deleteButton: { backgroundColor: '#ef4444' },
  actionButtonText: { fontSize: 18, color: '#fff' },
});