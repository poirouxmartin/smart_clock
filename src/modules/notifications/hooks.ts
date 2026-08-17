import { useState, useEffect, useCallback } from 'react';
import { NotificationService, getNotificationService } from './NotificationService';
import { NotificationPreferences, PushToken, ScheduledNotification, AlarmNotificationData, DEFAULT_NOTIFICATION_PREFS } from './types';

export function useNotifications(prefs?: Partial<NotificationPreferences>) {
  const [service] = useState(() => getNotificationService());
  const [initialized, setInitialized] = useState(false);
  const [permissions, setPermissions] = useState<NotificationService['permissions']>(null);
  const [pushToken, setPushToken] = useState<PushToken | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...prefs,
  });
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await service.initialize(prefs);
      if (mounted) {
        setInitialized(true);
        setPermissions(service.getPermissions());
        setPushToken(service.getPushTokenSync());
        setPreferences(service.getPreferences());
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [service, prefs]);

  const requestPermissions = useCallback(async () => {
    const perms = await service.requestPermissions();
    setPermissions(perms);
    if (perms.granted) {
      const token = await service.getPushToken();
      setPushToken(token);
    }
    return perms;
  }, [service]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    await service.updatePreferences(prefs);
    setPreferences(service.getPreferences());
  }, [service]);

  const scheduleAlarm = useCallback(async (alarm: any, wakeWindowStart: number, optimalWakeTime?: number, triggerReason?: string) => {
    return service.scheduleAlarmNotification(alarm, wakeWindowStart, optimalWakeTime, triggerReason);
  }, [service]);

  const scheduleBedtime = useCallback(async (bedtime: number, windDownStart: number) => {
    return service.scheduleBedtimeReminder(bedtime, windDownStart);
  }, [service]);

  const scheduleDailyBedtime = useCallback(async (hour: number, minute: number, days?: number[]) => {
    return service.scheduleDailyBedtimeReminder(hour, minute, days);
  }, [service]);

  const cancelNotification = useCallback(async (id: string) => {
    await service.cancelNotification(id);
  }, [service]);

  const cancelAll = useCallback(async () => {
    await service.cancelAllNotifications();
  }, [service]);

  const cancelByType = useCallback(async (type: ScheduledNotification['type']) => {
    await service.cancelNotificationsByType(type);
  }, [service]);

  const refreshScheduled = useCallback(async () => {
    const notifications = await service.getScheduledNotifications();
    // Convert to our type if needed
  }, [service]);

  const setBadge = useCallback(async (count: number) => {
    await service.setBadgeCount(count);
  }, [service]);

  const onAction = useCallback((actionId: string, handler: (data: any) => void) => {
    return service.onAction(actionId, handler);
  }, [service]);

  const presentLocal = useCallback(async (content: any) => {
    return service.presentLocalNotification(content);
  }, [service]);

  return {
    service,
    initialized,
    permissions,
    pushToken,
    preferences,
    requestPermissions,
    updatePreferences,
    scheduleAlarm,
    scheduleBedtime,
    scheduleDailyBedtime,
    cancelNotification,
    cancelAll,
    cancelByType,
    refreshScheduled,
    setBadge,
    onAction,
    presentLocal,
  };
}

export function useAlarmNotifications() {
  const { scheduleAlarm, cancelNotification, onAction, presentLocal } = useNotifications();
  const [activeAlarm, setActiveAlarm] = useState<AlarmNotificationData | null>(null);

  useEffect(() => {
    const unsubscribeTrigger = onAction('alarm_trigger', (data) => {
      setActiveAlarm(data);
    });
    const unsubscribeDismiss = onAction('alarm_dismiss', (data) => {
      if (activeAlarm?.alarmId === data.alarmId) {
        setActiveAlarm(null);
      }
    });
    const unsubscribeSnooze = onAction('alarm_snooze', (data) => {
      if (activeAlarm?.alarmId === data.alarmId) {
        setActiveAlarm(null);
      }
    });

    return () => {
      unsubscribeTrigger();
      unsubscribeDismiss();
      unsubscribeSnooze();
    };
  }, [onAction, activeAlarm]);

  const trigger = useCallback(async (alarm: any, wakeWindowStart: number, optimalWakeTime?: number, triggerReason?: string) => {
    const id = await scheduleAlarm(alarm, wakeWindowStart, optimalWakeTime, triggerReason);
    return id;
  }, [scheduleAlarm]);

  const dismiss = useCallback(async (alarmId: string) => {
    await cancelNotification(`alarm_${alarmId}`);
    setActiveAlarm(null);
  }, [cancelNotification]);

  const snooze = useCallback(async (alarmId: string, minutes: number = 10) => {
    await cancelNotification(`alarm_${alarmId}`);
    const snoozeTime = Date.now() + minutes * 60 * 1000;
    // Re-schedule with snooze
    setActiveAlarm(null);
  }, [cancelNotification]);

  return {
    activeAlarm,
    trigger,
    dismiss,
    snooze,
  };
}