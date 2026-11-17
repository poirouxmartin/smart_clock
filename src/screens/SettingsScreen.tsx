import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { Screen, Card, Row, ThemedSwitch, ThemePicker } from '@/components/Screen';
import { makeTypography, Spacing, Radius, useThemedStyles, type Palette } from '@/theme';
import type { RootStackParamList } from '@/types';
import { SmartAlarm } from '../../modules/smart-alarm';

const LOCALES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
] as const;

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { tCommon, tSettings, tSounds, tProfile, currentLocale, changeLocale } = useI18n();
  const styles = useThemedStyles(makeStyles);

  const [version, setVersion] = useState('');
  const [upcomingNotif, setUpcomingNotif] = useState(true);

  useEffect(() => {
    SmartAlarm.getAppVersion().then(setVersion).catch(() => {});
    SmartAlarm.getAutoStatus()
      .then(s => setUpcomingNotif(s.upcomingNotif))
      .catch(() => {});
  }, []);

  const handleToggleUpcoming = useCallback(async (value: boolean) => {
    setUpcomingNotif(value);
    try {
      const s = await SmartAlarm.setUpcomingNotification(value);
      setUpcomingNotif(s.upcomingNotif);
    } catch (e) {
      setUpcomingNotif(!value);
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const profileManager = getUserProfileManager();
      const json = await profileManager.exportData();
      Alert.alert(tSettings('exportData'), tCommon('save') + ' (voir console)', [{ text: tCommon('ok') }]);
      console.log('EXPORT:', json);
    } catch (e) {
      Alert.alert(tCommon('error'), tSettings('exportError'));
    }
  }, []);

  const confirmClear = useCallback((what: string) => {
    Alert.alert(
      tCommon('confirm'),
      what + ' ?',
      [
        { text: tCommon('cancel'), style: 'cancel' },
        {
          text: tCommon('delete'),
          style: 'destructive',
          onPress: async () => {
            await getUserProfileManager().clearAllData();
            Alert.alert(tCommon('ok'), tCommon('done'));
          },
        },
      ]
    );
  }, []);

  const handleOpenGithub = useCallback(() => {
    Linking.openURL('https://github.com/poirouxmartin/smart_clock');
  }, []);

  return (
    <Screen title={tSettings('title')} icon="settings-outline">
      <Card title={tSettings('appearance')} icon="color-palette-outline">
        <ThemePicker />
        <Text style={styles.label}>{tSettings('language')}</Text>
        <View style={styles.chipRow}>
          {LOCALES.map(l => {
            const active = l.code === currentLocale;
            return (
              <TouchableOpacity
                key={l.code}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => changeLocale(l.code)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card title={tSettings('alarm')} icon="alarm-outline">
        <Row
          label={tSettings('upcomingNotif')}
          right={<ThemedSwitch value={upcomingNotif} onValueChange={handleToggleUpcoming} />}
        />
        <Text style={styles.caption}>{tSettings('upcomingNotifHint')}</Text>
      </Card>

      <Card title={tSettings('soundsLights')} icon="musical-notes-outline">
        <Row label={tSounds('customSounds')} onPress={() => navigation.navigate('CustomSounds')} />
        <Row label={tSettings('lightIntegration')} onPress={() => navigation.navigate('Lights')} />
      </Card>

      <Card title={tSettings('dataPrivacy')} icon="shield-checkmark-outline">
        <Row label={tSettings('exportData')} onPress={handleExportData} />
        <Row label={tSettings('deleteHistory')} value={tCommon('delete')} destructive onPress={() => confirmClear(tSettings('deleteHistory'))} />
        <Row label={tProfile('clearAllData')} value={tCommon('delete')} destructive onPress={() => confirmClear(tProfile('clearAllData'))} />
      </Card>

      <Card title={tSettings('about')} icon="information-circle-outline">
        <Row label={tSettings('version')} value={version} />
        <Row label={tSettings('github')} onPress={handleOpenGithub} />
      </Card>
    </Screen>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    label: { ...T.caption, marginTop: Spacing.xl, marginBottom: Spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: c.borderLight },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { ...T.bodySmall, color: c.textSecondary },
    chipTextActive: { color: c.onPrimary, fontWeight: '600' },
    caption: { ...T.caption, color: c.textMuted, marginTop: Spacing.sm },
  });
};
