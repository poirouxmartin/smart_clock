import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getUserProfileManager } from '@/modules/user-profile';
import { getNotificationService } from '@/modules/notifications';
import { getSoundManager } from '@/modules/sound-manager';
import { getLightController } from '@/modules/light-controller';
import * as Linking from 'expo-linking';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { t, tCommon, tSettings, tAlarm, tNotifications, tSounds, tLights, tProfile, currentLocale, changeLocale } = useI18n();
  
  const [profile, setProfile] = useState<any>(null);
  const [notifPrefs, setNotifPrefs] = useState<any>({});
  const [soundPrefs, setSoundPrefs] = useState<any>({});
  const [lightPrefs, setLightPrefs] = useState<any>({});
  const [version, setVersion] = useState('1.0.0-dev');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const profileManager = getUserProfileManager();
      const notifService = getNotificationService();
      const soundManager = getSoundManager();
      const lightController = getLightController();
      
      setProfile(profileManager.getProfile());
      setNotifPrefs(notifService.getPreferences());
      setSoundPrefs(soundManager.getConfig());
      setLightPrefs(lightController.getConfig());
      setLoading(false);
    };
    loadData();
  }, []);

  const handleLocaleChange = useCallback(async (locale: string) => {
    await changeLocale(locale as any);
  }, [changeLocale]);

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

  const handleDeleteHistory = useCallback(async () => {
    Alert.alert(
      tCommon('confirm'),
      tSettings('deleteHistory') + ' ?',
      [
        { text: tCommon('cancel'), style: 'cancel' },
        { 
          text: tCommon('delete'), 
          style: 'destructive', 
          onPress: async () => {
            const profileManager = getUserProfileManager();
            await profileManager.clearAllData();
            setProfile(profileManager.getProfile());
            Alert.alert(tCommon('ok'), tCommon('done'));
          }
        }
      ]
    );
  }, []);

  const handleClearAll = useCallback(async () => {
    Alert.alert(
      tCommon('confirm'),
      tProfile('clearAllData') + ' ?',
      [
        { text: tCommon('cancel'), style: 'cancel' },
        { 
          text: tCommon('delete'), 
          style: 'destructive', 
          onPress: async () => {
            const profileManager = getUserProfileManager();
            await profileManager.clearAllData();
            setProfile(profileManager.getProfile());
            Alert.alert(tCommon('ok'), tCommon('done'));
          }
        }
      ]
    );
  }, []);

  const handleToggleNotif = useCallback(async (key: string, value: boolean) => {
    const notifService = getNotificationService();
    await notifService.updatePreferences({ [key]: value });
    setNotifPrefs(notifService.getPreferences());
  }, []);

  const handleToggleSound = useCallback(async (key: string, value: any) => {
    const soundManager = getSoundManager();
    soundManager.updateConfig({ [key]: value });
    setSoundPrefs(soundManager.getConfig());
  }, []);

  const handleToggleLight = useCallback(async (key: string, value: any) => {
    const lightController = getLightController();
    lightController.updateConfig({ [key]: value });
    setLightPrefs(lightController.getConfig());
  }, []);

  const handleOpenGithub = useCallback(() => {
    Linking.openURL('https://github.com/poirouxmartin/smart_clock');
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const locales = [
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'de', name: 'Deutsch' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{tSettings('title')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSettings('general')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => {}}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('language')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.itemValue}>{locales.find(l => l.code === currentLocale)?.name || currentLocale}</Text>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => {}}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('theme')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.itemValue}>{tSettings('system')}</Text>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSettings('alarm')}</Text>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tAlarm('smartWake')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => {}}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('wakeWindowDuration')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.itemValue}>1h30</Text>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tAlarm('fallbackAlarm')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSettings('soundsLights')}</Text>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSounds('natureSounds')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={soundPrefs.preloadSounds ?? true}
                onValueChange={(v) => handleToggleSound('preloadSounds', v)}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('CustomSounds')}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSounds('customSounds')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Lights')}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('lightIntegration')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => {}}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('fadeIn')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.itemValue}>{Math.round((soundPrefs.fadeInDuration ?? 30000) / 60000)} min</Text>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tNotifications('title')}</Text>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tNotifications('alarm')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={notifPrefs.alarmEnabled ?? true}
                onValueChange={(v) => handleToggleNotif('alarmEnabled', v)}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tNotifications('bedtimeReminder')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={notifPrefs.bedtimeReminderEnabled ?? true}
                onValueChange={(v) => handleToggleNotif('bedtimeReminderEnabled', v)}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tNotifications('windDown')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={notifPrefs.windDownEnabled ?? true}
                onValueChange={(v) => handleToggleNotif('windDownEnabled', v)}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tNotifications('criticalAlerts')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={notifPrefs.criticalAlertsEnabled ?? true}
                onValueChange={(v) => handleToggleNotif('criticalAlertsEnabled', v)}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSettings('dataPrivacy')}</Text>
          <TouchableOpacity style={styles.row} onPress={handleExportData}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('exportData')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleDeleteHistory}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('deleteHistory')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.destructiveText}>{tCommon('delete')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleClearAll}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tProfile('clearAllData')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.destructiveText}>{tCommon('delete')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('localOnly')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
                thumbColor="#fff"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tSettings('about')}</Text>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('version')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.itemValue}>{version}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleOpenGithub}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('github')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => {}}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemLabel}>{tSettings('licenses')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.actionText}>▶</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b9cb3', fontSize: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rowLeft: { flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemLabel: { fontSize: 16, color: '#e2e8f0' },
  itemValue: { fontSize: 15, color: '#8b9cb3' },
  actionText: { fontSize: 16, color: '#64748b' },
  destructiveText: { fontSize: 15, color: '#ef4444' },
});