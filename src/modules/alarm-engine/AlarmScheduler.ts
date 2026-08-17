import { AlarmConfig } from '@/types';
import { WakeWindow, AlarmSchedule, DEFAULT_ALARM_ENGINE_CONFIG, AlarmEngineConfig } from './types';

export class AlarmScheduler {
  private config: AlarmEngineConfig;

  constructor(config: Partial<AlarmEngineConfig> = {}) {
    this.config = { ...DEFAULT_ALARM_ENGINE_CONFIG, ...config };
  }

  computeNextOccurrence(alarm: AlarmConfig, fromTime: number = Date.now()): number {
    const now = new Date(fromTime);
    const currentDay = now.getDay();
    const [targetHour, targetMinute] = alarm.wakeWindowStart.split(':').map(Number);
    
    let targetDate = new Date(now);
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    
    if (targetDate.getTime() <= fromTime) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    while (!alarm.days.includes(targetDate.getDay())) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    return targetDate.getTime();
  }

  computeWakeWindow(alarm: AlarmConfig, occurrenceTime: number): WakeWindow {
    const start = occurrenceTime;
    const end = start + this.config.wakeWindowDurationMs;
    return { start, end, alarmId: alarm.id };
  }

  getNextSchedule(alarm: AlarmConfig, fromTime: number = Date.now()): AlarmSchedule {
    const nextOccurrence = this.computeNextOccurrence(alarm, fromTime);
    const wakeWindow = this.computeWakeWindow(alarm, nextOccurrence);
    return { alarm, nextWakeWindow: wakeWindow, nextOccurrence };
  }

  getAllUpcomingSchedules(alarms: AlarmConfig[], days: number = 7): AlarmSchedule[] {
    const now = Date.now();
    const schedules: AlarmSchedule[] = [];
    
    for (const alarm of alarms.filter(a => a.enabled)) {
      let checkTime = now;
      for (let i = 0; i < days * 2; i++) {
        const schedule = this.getNextSchedule(alarm, checkTime);
        if (schedule.nextOccurrence > now + days * 24 * 60 * 60 * 1000) break;
        schedules.push(schedule);
        checkTime = schedule.nextOccurrence + 1;
      }
    }
    
    return schedules.sort((a, b) => a.nextOccurrence - b.nextOccurrence);
  }

  isInWakeWindow(wakeWindow: WakeWindow, currentTime: number = Date.now()): boolean {
    return currentTime >= wakeWindow.start && currentTime <= wakeWindow.end;
  }

  getTimeUntilWakeWindow(wakeWindow: WakeWindow, currentTime: number = Date.now()): number {
    if (currentTime < wakeWindow.start) return wakeWindow.start - currentTime;
    if (currentTime > wakeWindow.end) return 0;
    return wakeWindow.end - currentTime;
  }

  getWakeWindowProgress(wakeWindow: WakeWindow, currentTime: number = Date.now()): number {
    const total = wakeWindow.end - wakeWindow.start;
    const elapsed = currentTime - wakeWindow.start;
    return Math.max(0, Math.min(1, elapsed / total));
  }
}

export function createAlarmScheduler(config?: Partial<AlarmEngineConfig>): AlarmScheduler {
  return new AlarmScheduler(config);
}