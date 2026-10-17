import { Platform } from 'react-native';
import { AlarmConfig } from '@/types';

export interface ForegroundServiceConfig {
  notificationId: number;
  channelId: string;
  channelName: string;
  channelDescription: string;
  icon: string;
  title: string;
  text: string;
}

export const DEFAULT_FOREGROUND_CONFIG: ForegroundServiceConfig = {
  notificationId: 888,
  channelId: 'smart_clock_alarm_service',
  channelName: 'Aube Alarm',
  channelDescription: 'Service de surveillance du réveil intelligent',
  icon: 'ic_notification',
  title: 'Aube actif',
  text: 'Surveillance du sommeil pour réveil optimal',
};

export interface AlarmServiceStatus {
  isRunning: boolean;
  alarmId?: string;
  wakeWindowStart?: number;
  wakeWindowEnd?: number;
  lastUpdate: number;
}

class AndroidForegroundService {
  private static instance: AndroidForegroundService;
  private config: ForegroundServiceConfig;
  private status: AlarmServiceStatus = { isRunning: false, lastUpdate: Date.now() };
  private listeners: Set<(status: AlarmServiceStatus) => void> = new Set();

  private constructor(config: Partial<ForegroundServiceConfig> = {}) {
    this.config = { ...DEFAULT_FOREGROUND_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ForegroundServiceConfig>): AndroidForegroundService {
    if (!AndroidForegroundService.instance) {
      AndroidForegroundService.instance = new AndroidForegroundService(config);
    }
    return AndroidForegroundService.instance;
  }

  async startService(alarm: AlarmConfig, wakeWindowStart: number, wakeWindowEnd: number): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('Foreground service only available on Android');
      return false;
    }

    try {
      this.status = {
        isRunning: true,
        alarmId: alarm.id,
        wakeWindowStart,
        wakeWindowEnd,
        lastUpdate: Date.now(),
      };
      this.notifyListeners();
      
      console.log('[ForegroundService] Started for alarm:', alarm.id);
      return true;
    } catch (error) {
      console.error('[ForegroundService] Failed to start:', error);
      return false;
    }
  }

  async stopService(): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    this.status = { isRunning: false, lastUpdate: Date.now() };
    this.notifyListeners();
    console.log('[ForegroundService] Stopped');
  }

  async updateNotification(text: string): Promise<void> {
    if (Platform.OS !== 'android' || !this.status.isRunning) return;
    
    this.status = { ...this.status, lastUpdate: Date.now() };
    this.notifyListeners();
  }

  getStatus(): AlarmServiceStatus {
    return { ...this.status };
  }

  addListener(callback: (status: AlarmServiceStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.getStatus()));
  }

  async requestExactAlarmPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      const { PermissionsAndroid } = require('react-native');
      // SCHEDULE_EXACT_ALARM is a special permission, it can only be checked
      // (the user enables it in Settings via the onboarding flow).
      return await PermissionsAndroid.check('android.permission.SCHEDULE_EXACT_ALARM');
    } catch {
      return false;
    }
  }

  async scheduleExactAlarm(triggerTimeMs: number, alarmId: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      const { NativeModules } = require('react-native');
      const { AlarmModule } = NativeModules;
      
      if (AlarmModule && AlarmModule.scheduleExact) {
        await AlarmModule.scheduleExact(triggerTimeMs, alarmId);
        return true;
      }
      
      console.warn('[ForegroundService] Native AlarmModule not available');
      return false;
    } catch (error) {
      console.error('[ForegroundService] Failed to schedule exact alarm:', error);
      return false;
    }
  }

  async cancelExactAlarm(alarmId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    try {
      const { NativeModules } = require('react-native');
      const { AlarmModule } = NativeModules;
      
      if (AlarmModule && AlarmModule.cancelExact) {
        await AlarmModule.cancelExact(alarmId);
      }
    } catch (error) {
      console.error('[ForegroundService] Failed to cancel exact alarm:', error);
    }
  }
}

export function getForegroundService(config?: Partial<ForegroundServiceConfig>): AndroidForegroundService {
  return AndroidForegroundService.getInstance(config);
}

export function isForegroundServiceSupported(): boolean {
  return Platform.OS === 'android';
}