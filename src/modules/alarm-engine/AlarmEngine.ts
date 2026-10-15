import { AlarmConfig } from '@/types';
import { AlarmScheduler, createAlarmScheduler } from './AlarmScheduler';
import { AlarmMonitor, createAlarmMonitor, ActiveAlarm, AlarmTriggerResult, AlarmState } from './AlarmMonitor';
import { getForegroundService, isForegroundServiceSupported, ForegroundServiceConfig } from './AndroidForegroundService';
import { SleepAnalyzer } from '@/modules/sleep-analysis';

export interface AlarmEngineConfig {
  scheduler: Partial<ConstructorParameters<typeof createAlarmScheduler>[0]>[0];
  monitor: Partial<ConstructorParameters<typeof createAlarmMonitor>[0]>[0];
  foregroundService: Partial<ForegroundServiceConfig>;
  enableForegroundService: boolean;
}

export interface EngineCallbacks {
  onAlarmTrigger: (alarm: ActiveAlarm, result: AlarmTriggerResult) => void;
  onAlarmDismissed: (alarmId: string) => void;
  onAlarmSnoozed: (alarmId: string, snoozeCount: number) => void;
  onStateChange: (alarm: ActiveAlarm) => void;
  onError: (error: Error, context: string) => void;
}

export class AlarmEngine {
  private scheduler: AlarmScheduler;
  private monitor: AlarmMonitor;
  private foregroundService: ReturnType<typeof getForegroundService> | null = null;
  private sleepAnalyzer: SleepAnalyzer | null = null;
  private callbacks: Partial<EngineCallbacks> = {};
  private enabledAlarms: Map<string, AlarmConfig> = new Map();
  private config: AlarmEngineConfig;
  private initialized = false;

  constructor(config: Partial<AlarmEngineConfig> = {}) {
    this.config = {
      scheduler: config.scheduler || {},
      monitor: config.monitor || {},
      foregroundService: config.foregroundService || {},
      enableForegroundService: config.enableForegroundService ?? true,
    };

    this.scheduler = createAlarmScheduler(this.config.scheduler);
    this.monitor = createAlarmMonitor(this.config.monitor, this.config.scheduler);

    this.monitor.setOnTrigger((alarm, result) => this.handleAlarmTrigger(alarm, result));
    this.monitor.setOnStateChange((alarm) => this.handleStateChange(alarm));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.enableForegroundService && isForegroundServiceSupported()) {
      this.foregroundService = getForegroundService(this.config.foregroundService);
      const hasPermission = await this.foregroundService.requestExactAlarmPermission();
      if (!hasPermission) {
        console.warn('[AlarmEngine] Exact alarm permission not granted');
      }
    }

    this.initialized = true;
    console.log('[AlarmEngine] Initialized');
  }

  setSleepAnalyzer(analyzer: SleepAnalyzer): void {
    this.sleepAnalyzer = analyzer;
    this.monitor.setSleepAnalyzer(analyzer);
  }

  setCallbacks(callbacks: Partial<EngineCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  addAlarm(alarm: AlarmConfig): void {
    if (!alarm.enabled) return;
    this.enabledAlarms.set(alarm.id, alarm);
    this.scheduleAlarm(alarm);
  }

  removeAlarm(alarmId: string): void {
    const alarm = this.enabledAlarms.get(alarmId);
    if (alarm) this.cancelTimers(alarm);
    this.enabledAlarms.delete(alarmId);
    this.monitor.stopMonitoring(alarmId);
    if (this.foregroundService) {
      this.foregroundService.cancelExactAlarm(alarmId);
    }
  }

  updateAlarm(alarm: AlarmConfig): void {
    this.removeAlarm(alarm.id);
    this.addAlarm(alarm);
  }

  getEnabledAlarms(): AlarmConfig[] {
    return Array.from(this.enabledAlarms.values());
  }

  private scheduleAlarm(alarm: AlarmConfig): void {
    const schedule = this.scheduler.getNextSchedule(alarm);
    const now = Date.now();
    const timeUntilWake = schedule.nextWakeWindow.start - now;

    if (timeUntilWake <= 0) {
      console.log('[AlarmEngine] Alarm window already started, starting monitoring immediately');
      this.startMonitoring(alarm, schedule.nextWakeWindow);
      return;
    }

    if (this.config.enableForegroundService && this.foregroundService && timeUntilWake < 24 * 60 * 60 * 1000) {
      this.foregroundService.scheduleExactAlarm(schedule.nextWakeWindow.start, alarm.id);
    }

    const timeout = setTimeout(() => {
      this.startMonitoring(alarm, schedule.nextWakeWindow);
      this.scheduleNextOccurrence(alarm);
    }, timeUntilWake);

    (alarm as any)._timeoutId = timeout;
  }

  private scheduleNextOccurrence(alarm: AlarmConfig): void {
    const schedule = this.scheduler.getNextSchedule(alarm, Date.now() + 1);
    const timeUntilNext = schedule.nextWakeWindow.start - Date.now();
    
    if (timeUntilNext > 0 && timeUntilNext < 7 * 24 * 60 * 60 * 1000) {
      const timeout = setTimeout(() => {
        this.startMonitoring(alarm, schedule.nextWakeWindow);
        this.scheduleNextOccurrence(alarm);
      }, timeUntilNext);
      
      (alarm as any)._nextTimeoutId = timeout;
    }
  }

  private startMonitoring(alarm: AlarmConfig, wakeWindow: { start: number; end: number; alarmId: string }): void {
    if (this.foregroundService) {
      this.foregroundService.startService(alarm, wakeWindow.start, wakeWindow.end);
    }

    const activeAlarm: ActiveAlarm = {
      alarm,
      state: 'scheduled',
      wakeWindow,
      monitoringStartTime: Date.now(),
      snoozeCount: 0,
      lastCheckTime: Date.now(),
    };

    this.monitor.startMonitoring(activeAlarm);
  }

  private handleAlarmTrigger(alarm: ActiveAlarm, result: AlarmTriggerResult): void {
    console.log('[AlarmEngine] Alarm triggered:', alarm.alarm.id, result.reason);
    
    if (this.foregroundService) {
      this.foregroundService.stopService();
    }

    if (this.callbacks.onAlarmTrigger) {
      this.callbacks.onAlarmTrigger(alarm, result);
    }
  }

  private handleStateChange(alarm: ActiveAlarm): void {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(alarm);
    }

    if (alarm.state === 'dismissed' && this.callbacks.onAlarmDismissed) {
      this.callbacks.onAlarmDismissed(alarm.alarm.id);
    }

    if (alarm.state === 'snoozed' && this.callbacks.onAlarmSnoozed) {
      this.callbacks.onAlarmSnoozed(alarm.alarm.id, alarm.snoozeCount);
    }
  }

  dismissAlarm(alarmId: string): void {
    this.monitor.dismissAlarm(alarmId);
    if (this.foregroundService) {
      this.foregroundService.stopService();
    }
  }

  snoozeAlarm(alarmId: string): boolean {
    const result = this.monitor.snoozeAlarm(alarmId);
    if (result && this.foregroundService) {
      const alarm = this.monitor.getActiveAlarm(alarmId);
      if (alarm) {
        this.foregroundService.startService(alarm.alarm, alarm.wakeWindow.start, alarm.wakeWindow.end);
      }
    }
    return result;
  }

  getActiveAlarm(alarmId: string): ActiveAlarm | undefined {
    return this.monitor.getActiveAlarm(alarmId);
  }

  getAllActiveAlarms(): ActiveAlarm[] {
    return this.monitor.getAllActiveAlarms();
  }

  isMonitoring(alarmId: string): boolean {
    return this.monitor.isMonitoring(alarmId);
  }

  getNextWakeTime(alarmId: string): number | null {
    const alarm = this.enabledAlarms.get(alarmId);
    if (!alarm) return null;
    const schedule = this.scheduler.getNextSchedule(alarm);
    return schedule.nextWakeWindow.start;
  }

  getTimeUntilWake(alarmId: string): number | null {
    return this.monitor.getTimeUntilTrigger(alarmId);
  }

  // Timers are stored on the alarm object by scheduleAlarm/scheduleNextOccurrence.
  private cancelTimers(alarm: AlarmConfig): void {
    clearTimeout((alarm as any)._timeoutId);
    clearTimeout((alarm as any)._nextTimeoutId);
  }

  async shutdown(): Promise<void> {
    for (const alarm of this.enabledAlarms.values()) {
      this.cancelTimers(alarm);
    }
    
    this.monitor.shutdown();
    
    if (this.foregroundService) {
      await this.foregroundService.stopService();
    }
    
    this.enabledAlarms.clear();
    this.initialized = false;
    console.log('[AlarmEngine] Shutdown complete');
  }
}

export function createAlarmEngine(config?: Partial<AlarmEngineConfig>): AlarmEngine {
  return new AlarmEngine(config);
}

let alarmEngineInstance: AlarmEngine | null = null;

export function getAlarmEngine(): AlarmEngine {
  if (!alarmEngineInstance) {
    alarmEngineInstance = new AlarmEngine();
  }
  return alarmEngineInstance;
}