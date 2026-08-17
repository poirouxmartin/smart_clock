import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  NotificationChannel,
  NOTIFICATION_CHANNELS,
  NotificationContent,
  ScheduledNotification,
  NotificationTrigger,
  NotificationAction,
  ALARM_ACTIONS,
  BEDTIME_ACTIONS,
  NotificationPermissions,
  PushToken,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  AlarmNotificationData,
} from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private initialized = false;
  private permissions: NotificationPermissions | null = null;
  private pushToken: PushToken | null = null;
  private preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFS;
  private responseListener: Notifications.Subscription | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private actionHandlers: Map<string, (data: any) => void> = new Map();

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(prefs?: Partial<NotificationPreferences>): Promise<void> {
    if (this.initialized) return;

    this.preferences = { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
    
    await this.setupChannels();
    await this.requestPermissions();
    await this.getPushToken();
    this.setupListeners();

    this.initialized = true;
    console.log('[NotificationService] Initialized');
  }

  private async setupChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    for (const channel of NOTIFICATION_CHANNELS) {
      if (!this.preferences[`${channel.id}Enabled` as keyof NotificationPreferences]) continue;

      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: this.mapImportance(channel.importance),
        sound: channel.sound ? { name: channel.sound, critical: channel.bypassDnd } : undefined,
        enableVibrate: channel.enableVibration && this.preferences.vibrationEnabled,
        vibrationPattern: channel.vibrationPattern,
        lightColor: channel.lightColor,
        lockscreenVisibility: channel.lockscreenVisibility,
        bypassDnd: channel.bypassDnd && this.preferences.criticalAlertsEnabled,
        showBadge: this.preferences.badgeEnabled,
      });
    }
  }

  private mapImportance(importance: NotificationChannel['importance']): Notifications.AndroidImportance {
    const map: Record<NotificationChannel['importance'], Notifications.AndroidImportance> = {
      min: Notifications.AndroidImportance.MIN,
      low: Notifications.AndroidImportance.LOW,
      default: Notifications.AndroidImportance.DEFAULT,
      high: Notifications.AndroidImportance.HIGH,
      max: Notifications.AndroidImportance.MAX,
    };
    return map[importance];
  }

  async requestPermissions(): Promise<NotificationPermissions> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    let canAskAgain = true;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: this.preferences.criticalAlertsEnabled,
          provideAppNotificationSettings: true,
        },
      });
      finalStatus = status;
      canAskAgain = status !== 'denied';
    }

    if (Platform.OS === 'android' && finalStatus === 'granted') {
      try {
        const exactAlarmPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.USE_EXACT_ALARM,
          {
            title: 'Permission réveil précis',
            message: 'Smart Clock a besoin de programmer des alarmes exactes pour vous réveiller au bon moment.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        if (exactAlarmPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[NotificationService] Exact alarm permission denied');
        }
      } catch (e) {
        console.warn('[NotificationService] Exact alarm permission error:', e);
      }
    }

    this.permissions = {
      granted: finalStatus === 'granted',
      canAskAgain,
      status: finalStatus,
    };

    return this.permissions;
  }

  async getPushToken(): Promise<PushToken | null> {
    if (!Device.isDevice) {
      console.warn('[NotificationService] Not a physical device, push token not available');
      return null;
    }

    if (!this.permissions?.granted) {
      await this.requestPermissions();
      if (!this.permissions?.granted) return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      this.pushToken = {
        token: tokenData.data,
        type: 'expo',
        platform: Platform.OS as 'ios' | 'android',
        createdAt: Date.now(),
      };
      
      console.log('[NotificationService] Push token:', this.pushToken.token);
      return this.pushToken;
    } catch (error) {
      console.error('[NotificationService] Failed to get push token:', error);
      return null;
    }
  }

  getPushTokenSync(): PushToken | null {
    return this.pushToken;
  }

  getPermissions(): NotificationPermissions | null {
    return this.permissions;
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    
    if (Platform.OS === 'android') {
      await this.setupChannels();
    }
  }

  private setupListeners(): void {
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('[NotificationService] Notification received:', notification.request.identifier);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data;
      
      console.log('[NotificationService] Action:', actionId, data);
      
      const handler = this.actionHandlers.get(actionId);
      if (handler) {
        handler(data);
      }
      
      if (actionId === 'dismiss') {
        this.handleDismissAction(data);
      } else if (actionId.startsWith('snooze')) {
        this.handleSnoozeAction(actionId, data);
      }
    });
  }

  private handleDismissAction(data: any): void {
    if (data?.alarmId) {
      const handler = this.actionHandlers.get('alarm_dismiss');
      if (handler) handler(data);
    }
  }

  private handleSnoozeAction(actionId: string, data: any): void {
    if (!data?.alarmId) return;
    
    const snoozeMinutes = actionId === 'snooze_5' ? 5 : 10;
    const handler = this.actionHandlers.get('alarm_snooze');
    if (handler) handler({ ...data, snoozeMinutes });
  }

  onAction(actionId: string, handler: (data: any) => void): () => void {
    this.actionHandlers.set(actionId, handler);
    return () => this.actionHandlers.delete(actionId);
  }

  async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt'>): Promise<string> {
    const id = notification.type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const trigger = this.buildTrigger(notification.trigger);
    
    const request: Notifications.NotificationRequestInput = {
      identifier: id,
      content: {
        title: notification.content.title,
        body: notification.content.body,
        data: notification.content.data,
        sound: notification.content.sound ? { name: notification.content.sound, critical: this.preferences.criticalAlertsEnabled } : this.preferences.soundEnabled ? 'default' : false,
        badge: notification.content.badge,
        categoryIdentifier: notification.content.categoryId,
        threadIdentifier: notification.content.threadId,
      },
      trigger,
    };

    if (notification.type === 'alarm') {
      request.content.categoryIdentifier = 'alarm';
    } else if (notification.type === 'bedtime_reminder') {
      request.content.categoryIdentifier = 'bedtime';
    }

    await Notifications.scheduleNotificationAsync(request);
    
    if (notification.repeats && notification.trigger.type === 'daily') {
      console.log('[NotificationService] Scheduled repeating notification:', id);
    }
    
    return id;
  }

  private buildTrigger(trigger: NotificationTrigger): Notifications.NotificationTriggerInput {
    switch (trigger.type) {
      case 'time':
        return {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor((trigger.timestamp - Date.now()) / 1000)),
          repeats: false,
        };
      case 'interval':
        return {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: trigger.seconds,
          repeats: trigger.repeats,
        };
      case 'daily':
        return {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: trigger.hour,
          minute: trigger.minute,
          repeats: true,
          days: trigger.days,
        };
      case 'calendar':
        return {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          ...trigger.dateComponents,
          repeats: false,
        };
      default:
        return { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false };
    }
  }

  async scheduleAlarmNotification(alarm: AlarmConfig, wakeWindowStart: number, optimalWakeTime?: number, triggerReason?: string): Promise<string> {
    const data: AlarmNotificationData = {
      alarmId: alarm.id,
      alarmLabel: alarm.label,
      wakeWindowStart,
      wakeWindowEnd: wakeWindowStart + 90 * 60 * 1000,
      soundId: alarm.soundId,
      volume: alarm.volume,
      lightEnabled: alarm.lightEnabled,
      vibrationEnabled: alarm.vibrationEnabled,
      snoozeEnabled: alarm.snoozeEnabled,
      snoozeDuration: alarm.snoozeDuration * 60 * 1000,
      isSmartWake: true,
      optimalWakeTime,
      triggerReason,
    };

    const wakeTime = new Date(wakeWindowStart);
    
    return this.scheduleNotification({
      type: 'alarm',
      trigger: { type: 'time', timestamp: wakeWindowStart },
      content: {
        title: '🌅 Réveil intelligent',
        body: `Fenêtre de réveil: ${wakeTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${new Date(wakeWindowStart + 90 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        data,
        categoryId: 'alarm',
        sound: 'default',
        badge: 1,
      },
      alarmId: alarm.id,
    });
  }

  async scheduleBedtimeReminder(bedtime: number, windDownStart: number): Promise<{ reminderId: string; windDownId: string }> {
    const bedtimeDate = new Date(bedtime);
    const windDownDate = new Date(windDownStart);

    const reminderId = await this.scheduleNotification({
      type: 'bedtime_reminder',
      trigger: { type: 'time', timestamp: bedtime },
      content: {
        title: '🌙 Heure du coucher',
        body: `Il est ${bedtimeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. L'heure idéale pour vous coucher.`,
        data: { type: 'bedtime', bedtime },
        categoryId: 'bedtime',
        sound: 'default',
      },
    });

    const windDownId = await this.scheduleNotification({
      type: 'wind_down',
      trigger: { type: 'time', timestamp: windDownStart },
      content: {
        title: '📱 Déconnexion',
        body: `Commencez votre routine du soir. Coucher dans ${Math.round((bedtime - windDownStart) / 60000)}min.`,
        data: { type: 'wind_down', bedtime, windDownStart },
        categoryId: 'bedtime',
        sound: 'default',
      },
    });

    return { reminderId, windDownId };
  }

  async scheduleDailyBedtimeReminder(hour: number, minute: number, days: number[] = [0,1,2,3,4,5,6]): Promise<string> {
    return this.scheduleNotification({
      type: 'bedtime_reminder',
      trigger: { type: 'daily', hour, minute, days },
      content: {
        title: '🌙 Rappel coucher',
        body: 'C\'est l\'heure de préparer votre sommeil pour être en forme demain !',
        data: { type: 'bedtime_daily' },
        categoryId: 'bedtime',
        sound: 'default',
      },
      repeats: true,
    });
  }

  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async cancelNotificationsByType(type: ScheduledNotification['type']): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled
      .filter(n => n.content.data?.type?.startsWith(type) || n.identifier.startsWith(type))
      .map(n => n.identifier);
    
    await Promise.all(toCancel.map(id => Notifications.cancelScheduledNotificationAsync(id)));
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  async dismissNotification(identifier: string): Promise<void> {
    await Notifications.dismissNotificationAsync(identifier);
  }

  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  async presentLocalNotification(content: NotificationContent): Promise<string> {
    return Notifications.presentNotificationAsync({
      title: content.title,
      body: content.body,
      data: content.data,
      sound: content.sound ? { name: content.sound, critical: this.preferences.criticalAlertsEnabled } : this.preferences.soundEnabled ? 'default' : false,
      badge: content.badge,
      categoryIdentifier: content.categoryId,
      threadIdentifier: content.threadId,
    });
  }

  async setupCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('alarm', ALARM_ACTIONS);
    await Notifications.setNotificationCategoryAsync('bedtime', BEDTIME_ACTIONS);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.actionHandlers.clear();
    this.initialized = false;
  }
}

export function getNotificationService(): NotificationService {
  return NotificationService.getInstance();
}