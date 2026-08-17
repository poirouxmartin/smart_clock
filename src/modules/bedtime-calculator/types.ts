export interface BedtimeCalculationInput {
  targetWakeTime: number;
  sleepCycleLength: number;
  desiredCycles: number;
  fallAsleepDuration: number;
  bedtimeWindowStart?: number;
  bedtimeWindowEnd?: number;
  chronotype?: 'morning' | 'evening' | 'intermediate';
  age?: number;
}

export interface BedtimeResult {
  idealBedtime: number;
  bedtimeWindow: { start: number; end: number };
  totalSleepTime: number;
  cycles: number;
  fallAsleepEnd: number;
  wakeUpAtEndOfCycle: boolean;
  confidence: number;
  reasoning: string[];
  alternativeBedtimes: AlternativeBedtime[];
}

export interface AlternativeBedtime {
  bedtime: number;
  cycles: number;
  totalSleepTime: number;
  pros: string;
  cons: string;
}

export interface BedtimeNotificationConfig {
  enabled: boolean;
  reminderBeforeMinutes: number;
  windDownStartMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface SleepSchedule {
  id: string;
  name: string;
  targetWakeTime: string;
  days: number[];
  sleepCycleLength: number;
  desiredCycles: number;
  fallAsleepDuration: number;
  chronotype: 'morning' | 'evening' | 'intermediate';
  bedtimeNotification: BedtimeNotificationConfig;
  enabled: boolean;
}

export const DEFAULT_SLEEP_CYCLE_LENGTH = 90 * 60 * 1000;
export const DEFAULT_FALL_ASLEEP_DURATION = 15 * 60 * 1000;
export const DEFAULT_DESIRED_CYCLES = 5;
export const MIN_CYCLES = 3;
export const MAX_CYCLES = 6;
export const MIN_FALL_ASLEEP = 5 * 60 * 1000;
export const MAX_FALL_ASLEEP = 60 * 60 * 1000;

export const CHRONOTYPE_ADJUSTMENTS = {
  morning: { cycleLength: -5 * 60 * 1000, fallAsleep: -5 * 60 * 1000 },
  evening: { cycleLength: +10 * 60 * 1000, fallAsleep: +10 * 60 * 1000 },
  intermediate: { cycleLength: 0, fallAsleep: 0 },
} as const;