import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { getSoundManager } from '@/modules/sound-manager';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Screen, Card } from '@/components/Screen';
import { makeTypography, Spacing, Radius, useTheme, useThemedStyles, type Palette } from '@/theme';

export function CustomSoundsScreen() {
  const { tCommon, tSounds } = useI18n();
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  
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
      const name = asset.name?.replace(/\.[^/.]+$/, '') || tSounds('customSoundDefault');
      
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
      tCommon('confirmQuestion', { what: tCommon('delete') }),
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
      <Screen title={tSounds('customSounds')} icon="musical-notes-outline">
        <Text style={styles.helpText}>{tCommon('loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen title={tSounds('customSounds')} icon="musical-notes-outline">
      <Card title={tSounds('addCustom')}>
        <TouchableOpacity style={styles.addButton} onPress={addCustomSound}>
          <Text style={styles.addButtonText}>+ {tSounds('addCustom')}</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>{tCommon('withDetail', { text: tSounds('importAudio'), detail: 'MP3, WAV, M4A' })}</Text>
      </Card>

      {customSounds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{tSounds('customSounds')}</Text>
          <Text style={styles.emptySubtext}>{tCommon('noData')}</Text>
        </View>
      ) : (
        <Card title={`${tCommon('sounds')} (${customSounds.length})`}>
          {customSounds.map(sound => (
            <View key={sound.id} style={styles.soundRow}>
              <View style={styles.soundInfo}>
                <Text style={styles.soundName}>{sound.name}</Text>
                <Text style={styles.soundType}>{tSounds('customSounds')}</Text>
              </View>
              <View style={styles.soundActions}>
                <TouchableOpacity style={[styles.actionButton, styles.playButton]} onPress={() => playSound(sound.id)}>
                  <Ionicons name="play" size={18} color={c.onPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => removeSound(sound.id)}>
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    addButton: { backgroundColor: c.primary, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', marginBottom: Spacing.sm },
    addButtonText: { ...T.body, color: c.onPrimary, fontWeight: '600' },
    helpText: { ...T.caption, textAlign: 'center' },
    emptyState: { padding: 40, alignItems: 'center', backgroundColor: c.bgCard + 'e6', borderRadius: 24, borderWidth: 1, borderColor: c.border },
    emptyText: { ...T.h3, marginBottom: Spacing.sm },
    emptySubtext: { ...T.bodySmall, color: c.textMuted },
    soundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    soundInfo: { flex: 1 },
    soundName: { ...T.body, color: c.text, fontWeight: '600' },
    soundType: { ...T.caption },
    soundActions: { flexDirection: 'row', gap: Spacing.md },
    actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
    playButton: { backgroundColor: c.primary },
  });
};
