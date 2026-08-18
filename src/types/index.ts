export type SleepStage = 'awake' | 'light' | 'deep' | 'rem' | 'unknown';

export interface SleepEpoch {
  timestamp: number;
  stage: SleepStage;
  confidence: number;
  movementScore: number;
  audioScore: number;
}

export interface SleepSession {
  id: string;
  startTime: number;
  endTime?: number;
  epochs: SleepEpoch[];
  targetWakeWindow: { start: number; end: number };
  actualWakeTime?: number;
  qualityRating?: 'great' | 'good' | 'ok' | 'poor';
}

export interface UserProfile {
  id: string;
  typicalBedtime: string;
  typicalWakeTime: string;
  sleepCycleLength: number;
  fallAsleepDuration: number;
  preferredWakeSounds: string[];
  preferredLightSettings: LightSettings;
  sleepHistory: SleepSession[];
  onboardingComplete: boolean;
}

export interface LightSettings {
  enabled: boolean;
  deviceId?: string;
  brightness: number;
  colorTemp: number;
  fadeInDuration: number;
}

export interface AlarmConfig {
  id: string;
  label: string;
  wakeWindowStart: string;
  wakeWindowEnd: string;
  days: number[];
  enabled: boolean;
  soundId: string;
  volume: number;
  lightEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeDuration: number;
}

export interface SoundAsset {
  id: string;
  name: string;
  uri: string;
  type: 'nature' | 'custom' | 'system';
  duration: number;
  loopable: boolean;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  AlarmSetup: { alarmId?: string };
  SleepAnalysis: { sessionId?: string };
  Settings: undefined;
  DevTools: undefined;
  CustomSounds: undefined;
  Lights: undefined;
};