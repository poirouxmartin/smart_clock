import { AlarmConfig } from '@/types';

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: 'min' | 'low' | 'default' | 'high' | 'max';
  sound?: string;
  enableVibration: boolean;
  vibrationPattern?: number[];
  lightColor?: string;
  lockscreenVisibility: 'public' | 'private' | 'secret';
  bypassDnd: boolean;
}

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'alarm',
    name: 'Réveil intelligent',
    description: 'Alarmes de réveil avec détection phase légère',
    importance: 'max',
    enableVibration: true,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#0ea5e9',
    lockscreenVisibility: 'public',
    bypassDnd: true,
  },
  {
    id: 'bedtime_reminder',
    name: 'Rappel coucher',
    description: 'Notification pour aller se coucher à l\'heure idéale',
    importance: 'high',
    enableVibration: true,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#22c55e',
    lockscreenVisibility: 'private',
    bypassDnd: false,
  },
  {
    id: 'wind_down',
    name: 'Déconnexion',
    description: 'Début de la période de déconnexion avant le coucher',
    importance: 'default',
    enableVibration: false,
    lightColor: '#7c3aed',
    lockscreenVisibility: 'private',
    bypassDnd: false,
  },
  {
    id: 'sleep_tracking',
    name: 'Suivi sommeil',
    description: 'Notifications liées au suivi du sommeil (début, fin)',
    importance: 'low',
    enableVibration: false,
    lockscreenVisibility: 'private',
    bypassDnd: false,
  },
  {
    id: 'system',
    name: 'Système',
    description: 'Notifications système (mises à jour, erreurs, etc.)',
    importance: 'default',
    enableVibration: false,
    lockscreenVisibility: 'private',
    bypassDnd: false,
  },
];

export interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  categoryId?: string;
  threadId?: string;
}

export interface ScheduledNotification {
  id: string;
  type: 'alarm' | 'bedtime_reminder' | 'wind_down' | 'sleep_tracking' | 'system';
  trigger: NotificationTrigger;
  content: NotificationContent;
  alarmId?: string;
  repeats?: boolean;
  createdAt: number;
}

export type NotificationTrigger = 
  | { type: 'time'; timestamp: number }
  | { type: 'interval'; seconds: number; repeats: boolean }
  | { type: 'daily'; hour: number; minute: number; days?: number[] }
  | { type: 'calendar'; dateComponents: Partial<{ year: number; month: number; day: number; hour: number; minute: number; weekday: number }> };

export interface NotificationAction {
  identifier: string;
  title: string;
  options: {
    isDestructive?: boolean;
    isAuthenticationRequired?: boolean;
    opensAppToForeground?: boolean;
  };
}

export const ALARM_ACTIONS: NotificationAction[] = [
  {
    identifier: 'dismiss',
    title: 'Réveillé',
    options: { isDestructive: true, opensAppToForeground: false },
  },
  {
    identifier: 'snooze',
    title: 'Snooze 10min',
    options: { opensAppToForeground: false },
  },
  {
    identifier: 'snooze_5',
    title: 'Snooze 5min',
    options: { opensAppToForeground: false },
  },
];

export const BEDTIME_ACTIONS: NotificationAction[] = [
  {
    identifier: 'dismiss',
    title: 'Ignorer',
    options: { isDestructive: true, opensAppToForeground: false },
  },
  {
    identifier: 'wind_down_now',
    title: 'Commencer déconnexion',
    options: { opensAppToForeground: true },
  },
];

export interface NotificationPermissions {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  ios?: {
    allowsAlerts: boolean;
    allowsBadges: boolean;
    allowsSounds: boolean;
    allowsCriticalAlerts: boolean;
    providesAppNotificationSettings: boolean;
  };
  android?: {
    channelIds: string[];
  };
}

export interface PushToken {
  token: string;
  type: 'expo' | 'fcm' | 'apns';
  platform: 'ios' | 'android';
  createdAt: number;
}

export interface NotificationPreferences {
  alarmEnabled: boolean;
  bedtimeReminderEnabled: boolean;
  windDownEnabled: boolean;
  sleepTrackingEnabled: boolean;
  systemEnabled: boolean;
  criticalAlertsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  alarmEnabled: true,
  bedtimeReminderEnabled: true,
  windDownEnabled: true,
  sleepTrackingEnabled: true,
  systemEnabled: true,
  criticalAlertsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
};

export interface AlarmNotificationData {
  alarmId: string;
  alarmLabel: string;
  wakeWindowStart: number;
  wakeWindowEnd: number;
  soundId: string;
  volume: number;
  lightEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeDuration: number;
  isSmartWake: boolean;
  optimalWakeTime?: number;
  triggerReason?: string;
}