import { useCallback, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';
import { SmartAlarm } from '../../../modules/smart-alarm';
import type { AutoStatus } from '../../../modules/smart-alarm';
import { DEFAULT_NIGHT_SETTINGS, NIGHT_SETTINGS_KEY, type NightSettings } from './wakeChoices';

/** Asks for the permissions automatic detection needs. Returns true when activity recognition was denied. */
export async function requestAutoPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  let activityDenied = false;
  try {
    if (Number(Platform.Version) >= 29) {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
      activityDenied = res !== PermissionsAndroid.RESULTS.GRANTED;
    }
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
  } catch (e) {
    console.error('requestAutoPermissions error:', e);
  }
  return activityDenied;
}

const configure = (s: NightSettings) =>
  SmartAlarm.configureAuto({
    enabled: s.auto,
    hour: Math.floor(s.targetMinutes / 60),
    minute: s.targetMinutes % 60,
    daysMask: s.daysMask,
    dayMinutes: s.dayMinutes,
    windowMinutes: s.windowMinutes,
  });

/** Night settings stored in the DB, reloaded on each screen focus; changes are saved and pushed to the native side. */
export function useNightSettings(opts: { applyOnLoad?: boolean } = {}) {
  const { applyOnLoad = false } = opts;
  const [settings, setSettings] = useState<NightSettings>(DEFAULT_NIGHT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  const settingsRef = useRef<NightSettings>(DEFAULT_NIGHT_SETTINGS);
  const firstLoad = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const saved = await getDatabaseService().getSetting<NightSettings>(NIGHT_SETTINGS_KEY, DEFAULT_NIGHT_SETTINGS);
          const merged = { ...DEFAULT_NIGHT_SETTINGS, ...saved };
          if (!Array.isArray(merged.dayMinutes) || merged.dayMinutes.length !== 7) merged.dayMinutes = DEFAULT_NIGHT_SETTINGS.dayMinutes;
          if (!active) return;
          settingsRef.current = merged;
          setSettings(merged);
          setLoaded(true);
          if (firstLoad.current) {
            firstLoad.current = false;
            if (applyOnLoad) await configure(merged);
          }
          const st = await SmartAlarm.getAutoStatus();
          if (active) setAutoStatus(st);
        } catch (e) {
          console.error('Load night settings error:', e);
        }
      })();
      return () => {
        active = false;
      };
    }, [applyOnLoad])
  );

  const updateSettings = useCallback(async (partial: Partial<NightSettings>) => {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setSettings(next);
    try {
      await getDatabaseService().setSetting(NIGHT_SETTINGS_KEY, next);
    } catch (e) {
      console.error('Save night settings error:', e);
    }
    try {
      await configure(next);
      setAutoStatus(await SmartAlarm.getAutoStatus());
    } catch (e) {
      console.error('configureAuto error:', e);
    }
  }, []);

  return { settings, loaded, autoStatus, setAutoStatus, updateSettings };
}
