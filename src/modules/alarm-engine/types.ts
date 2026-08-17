import { AlarmConfig } from '@/types';

export interface WakeWindow {
  start: number;
  end: number;
  alarmId: string;
}

export interface AlarmSchedule {
  alarm: AlarmConfig;
  nextWakeWindow: WakeWindow;
  nextOccurrence: number;
}

export interface AlarmEngineConfig {
  wakeWindowDurationMs: number;
  fallbackGracePeriodMs: number;
  minLightSleepDurationMs: number;
  lightSleepThreshold: number;
  checkIntervalMs: number;
  foregroundServiceEnabled: boolean;
}

export const DEFAULT_ALARM_ENGINE_CONFIG: AlarmEngineConfig = {
  wakeWindowDurationMs: 90 * 60 * 1000,
  fallbackGracePeriodMs: 5 * 60 * 1000,
  minLightSleepDurationMs: 3 * 60 * 1000,
  lightSleepThreshold: 0.6,
  checkIntervalMs: 30 * 1000,
  foregroundServiceEnabled: true,
};

export type AlarmState = 'scheduled' | 'monitoring' | 'triggered' | 'dismissed' | 'snoozed' | 'failed';

export interface ActiveAlarm {
  alarm: AlarmConfig;
  state: AlarmState;
  wakeWindow: WakeWindow;
  monitoringStartTime: number;
  snoozeCount: number;
  lastCheckTime: number;
  optimalWakeTime?: number;
  triggerReason?: string;
}

export interface AlarmTriggerResult {
  shouldTrigger: boolean;
  reason: string;
  confidence: number;
  optimalTime: number;
}

export interface SnoozeConfig {
  durationMs: number;
  maxSnoozes: number;
  requireLightSleep: boolean;
}