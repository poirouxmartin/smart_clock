import { ActiveAlarm, AlarmTriggerResult, AlarmState, DEFAULT_ALARM_ENGINE_CONFIG, AlarmEngineConfig, SnoozeConfig } from './types';
import { SleepAnalyzer, WakeTriggerResult } from '@/modules/sleep-analysis';

const DEFAULT_SNOOZE_CONFIG: SnoozeConfig = {
  durationMs: 10 * 60 * 1000,
  maxSnoozes: 3,
  requireLightSleep: true,
};

export class AlarmMonitor {
  private config: AlarmEngineConfig;
  private snoozeConfig: SnoozeConfig;
  private activeAlarms: Map<string, ActiveAlarm> = new Map();
  private sleepAnalyzer: SleepAnalyzer | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private onTriggerCallback: ((alarm: ActiveAlarm, result: AlarmTriggerResult) => void) | null = null;
  private onStateChangeCallback: ((alarm: ActiveAlarm) => void) | null = null;

  constructor(
    config: Partial<AlarmEngineConfig> = {},
    snoozeConfig: Partial<SnoozeConfig> = {}
  ) {
    this.config = { ...DEFAULT_ALARM_ENGINE_CONFIG, ...config };
    this.snoozeConfig = { ...DEFAULT_SNOOZE_CONFIG, ...snoozeConfig };
  }

  setSleepAnalyzer(analyzer: SleepAnalyzer): void {
    this.sleepAnalyzer = analyzer;
  }

  setOnTrigger(callback: (alarm: ActiveAlarm, result: AlarmTriggerResult) => void): void {
    this.onTriggerCallback = callback;
  }

  setOnStateChange(callback: (alarm: ActiveAlarm) => void): void {
    this.onStateChangeCallback = callback;
  }

  startMonitoring(alarm: ActiveAlarm): void {
    if (this.activeAlarms.has(alarm.alarm.id)) return;
    
    this.activeAlarms.set(alarm.alarm.id, { ...alarm, state: 'monitoring', monitoringStartTime: Date.now() });
    this.notifyStateChange(alarm.alarm.id);
    this.startPeriodicCheck();
  }

  stopMonitoring(alarmId: string): void {
    this.activeAlarms.delete(alarmId);
    if (this.activeAlarms.size === 0) {
      this.stopPeriodicCheck();
    }
  }

  dismissAlarm(alarmId: string): void {
    const alarm = this.activeAlarms.get(alarmId);
    if (alarm) {
      alarm.state = 'dismissed';
      this.notifyStateChange(alarmId);
      this.stopMonitoring(alarmId);
    }
  }

  snoozeAlarm(alarmId: string): boolean {
    const alarm = this.activeAlarms.get(alarmId);
    if (!alarm || alarm.snoozeCount >= this.snoozeConfig.maxSnoozes) return false;

    alarm.state = 'snoozed';
    alarm.snoozeCount++;
    alarm.wakeWindow.start = Date.now();
    alarm.wakeWindow.end = alarm.wakeWindow.start + this.snoozeConfig.durationMs;
    alarm.state = 'monitoring';
    alarm.monitoringStartTime = Date.now();
    
    this.notifyStateChange(alarmId);
    return true;
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      this.checkAllAlarms();
    }, this.config.checkIntervalMs);
  }

  private stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkAllAlarms(): void {
    const now = Date.now();
    
    for (const [alarmId, alarm] of this.activeAlarms) {
      if (alarm.state !== 'monitoring') continue;
      
      if (now >= alarm.wakeWindow.end) {
        this.triggerAlarm(alarmId, {
          shouldTrigger: true,
          reason: 'Fin de fenêtre de réveil (fallback)',
          confidence: 1,
          optimalTime: alarm.wakeWindow.end,
        });
        continue;
      }

      if (this.sleepAnalyzer && now >= alarm.wakeWindow.start) {
        const trigger = this.sleepAnalyzer.checkWakeTrigger(
          alarm.wakeWindow.start,
          alarm.wakeWindow.end,
          now
        );

        if (trigger.shouldWake) {
          this.triggerAlarm(alarmId, {
            shouldTrigger: true,
            reason: trigger.reason,
            confidence: trigger.confidence,
            optimalTime: trigger.optimalWakeTime,
          });
        }
      }
      
      alarm.lastCheckTime = now;
    }
  }

  private triggerAlarm(alarmId: string, result: AlarmTriggerResult): void {
    const alarm = this.activeAlarms.get(alarmId);
    if (!alarm) return;

    alarm.state = 'triggered';
    alarm.optimalWakeTime = result.optimalTime;
    alarm.triggerReason = result.reason;
    
    this.notifyStateChange(alarmId);
    
    if (this.onTriggerCallback) {
      this.onTriggerCallback(alarm, result);
    }
    
    this.stopMonitoring(alarmId);
  }

  private notifyStateChange(alarmId: string): void {
    const alarm = this.activeAlarms.get(alarmId);
    if (alarm && this.onStateChangeCallback) {
      this.onStateChangeCallback(alarm);
    }
  }

  getActiveAlarm(alarmId: string): ActiveAlarm | undefined {
    return this.activeAlarms.get(alarmId);
  }

  getAllActiveAlarms(): ActiveAlarm[] {
    return Array.from(this.activeAlarms.values());
  }

  isMonitoring(alarmId: string): boolean {
    const alarm = this.activeAlarms.get(alarmId);
    return alarm?.state === 'monitoring';
  }

  getTimeUntilTrigger(alarmId: string): number | null {
    const alarm = this.activeAlarms.get(alarmId);
    if (!alarm || alarm.state !== 'monitoring') return null;
    return Math.max(0, alarm.wakeWindow.end - Date.now());
  }

  shutdown(): void {
    this.stopPeriodicCheck();
    this.activeAlarms.clear();
    this.sleepAnalyzer = null;
  }
}

export function createAlarmMonitor(
  config?: Partial<AlarmEngineConfig>,
  snoozeConfig?: Partial<SnoozeConfig>
): AlarmMonitor {
  return new AlarmMonitor(config, snoozeConfig);
}