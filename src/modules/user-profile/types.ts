export interface UserProfile {
  id: string;
  createdAt: number;
  updatedAt: number;
  
  // Informations de base
  name?: string;
  birthDate?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  
  // Sommeil
  chronotype: 'morning' | 'evening' | 'intermediate';
  sleepCycleLength: number;
  fallAsleepDuration: number;
  desiredCycles: number;
  typicalBedtime: string;
  typicalWakeTime: string;
  
  // Préférences réveil
  preferredSounds: string[];
  defaultVolume: number;
  defaultFadeInDuration: number;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeDuration: number;
  
  // Lumière
  lightEnabled: boolean;
  lightDeviceIds: string[];
  wakeUpLightConfig: WakeUpLightConfig;
  
  // Notifications
  bedtimeReminderEnabled: boolean;
  bedtimeReminderMinutes: number;
  windDownEnabled: boolean;
  windDownMinutes: number;
  
  // Apprentissage adaptatif
  adaptiveLearningEnabled: boolean;
  learnedRmsBaseline: number;
  learnedAccelBaseline: number;
  learnedCycleLength: number;
  learnedFallAsleep: number;
  sleepEfficiencyHistory: number[];
  
  // Confidentialité
  dataRetentionDays: number;
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
}

export interface WakeUpLightConfig {
  enabled: boolean;
  startBrightness: number;
  endBrightness: number;
  startColorTemp: number;
  endColorTemp: number;
  duration: number;
  startBeforeAlarm: number;
}

export interface SleepSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  targetWakeWindow: { start: number; end: number };
  actualWakeTime?: number;
  wakeTriggerReason?: string;
  wakeConfidence?: number;
  
  // Métriques calculées
  totalSleepTime?: number;
  sleepEfficiency?: number;
  deepSleepRatio?: number;
  lightSleepRatio?: number;
  remSleepRatio?: number;
  awakeRatio?: number;
  cyclesCount?: number;
  fallAsleepDuration?: number;
  wakeAfterSleepOnset?: number;
  
  // Qualité subjective
  qualityRating?: 'great' | 'good' | 'ok' | 'poor';
  moodRating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  
  // Données brutes (JSON)
  rawEpochs?: string;
  rawAudioFeatures?: string;
  rawAccelFeatures?: string;
  
  createdAt: number;
  updatedAt: number;
}

export interface SleepTrend {
  date: string;
  avgSleepTime: number;
  avgEfficiency: number;
  avgQuality: number;
  avgCycles: number;
  bedtimeConsistency: number;
  wakeTimeConsistency: number;
}

export interface AdaptiveLearningData {
  rmsBaseline: number;
  accelBaseline: number;
  cycleLength: number;
  fallAsleepDuration: number;
  lastUpdated: number;
  sampleCount: number;
}

export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  chronotype: 'intermediate',
  sleepCycleLength: 90 * 60 * 1000,
  fallAsleepDuration: 15 * 60 * 1000,
  desiredCycles: 5,
  typicalBedtime: '22:30',
  typicalWakeTime: '07:00',
  preferredSounds: ['birds', 'waves', 'rain'],
  defaultVolume: 0.7,
  defaultFadeInDuration: 30 * 60 * 1000,
  vibrationEnabled: true,
  snoozeEnabled: true,
  snoozeDuration: 10 * 60 * 1000,
  lightEnabled: false,
  lightDeviceIds: [],
  wakeUpLightConfig: {
    enabled: true,
    startBrightness: 1,
    endBrightness: 100,
    startColorTemp: 2000,
    endColorTemp: 4000,
    duration: 30 * 60 * 1000,
    startBeforeAlarm: 30 * 60 * 1000,
  },
  bedtimeReminderEnabled: true,
  bedtimeReminderMinutes: 15,
  windDownEnabled: true,
  windDownMinutes: 30,
  adaptiveLearningEnabled: true,
  learnedRmsBaseline: 0.01,
  learnedAccelBaseline: 0.1,
  learnedCycleLength: 90 * 60 * 1000,
  learnedFallAsleep: 15 * 60 * 1000,
  sleepEfficiencyHistory: [],
  dataRetentionDays: 365,
  analyticsEnabled: true,
  crashReportingEnabled: true,
};

export const DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS sleep_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user_profile (id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_time ON sleep_sessions (user_id, created_at);
  
  CREATE TABLE IF NOT EXISTS adaptive_learning (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user_profile (id)
  );
  
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;