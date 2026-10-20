import { requireNativeModule } from 'expo-modules-core';

export type NightStatus = {
  state: 'idle' | 'tracking' | 'ringing' | 'done';
  sessionId: string | null;
  startedAtMs: number;
  targetAtMs: number;
  windowMinutes: number;
  firedAtMs: number;
  firedReason: string | null;
  epochCount: number;
  lastActivity: number;
  summarySeen: boolean;
};

export type PermissionStatus = {
  exactAlarm: boolean;
  fullScreenIntent: boolean;
  notifications: boolean;
  ignoringBatteryOptimizations: boolean;
};

export type AutoConfig = {
  enabled: boolean;
  hour: number;
  minute: number;
  daysMask: number;
  windowMinutes: number;
};

export type AutoStatus = {
  enabled: boolean;
  hour: number;
  minute: number;
  daysMask: number;
  windowMinutes: number;
  currentTargetMs: number;
  usualBedMinute: number;
  apiConfidence: number;
};

export type WakeSound = 'system' | 'birds' | 'waves' | 'forest' | 'rain' | 'stream';

export type WakeOptions = {
  sound: WakeSound;
  rampSeconds: number;
  dawnEnabled: boolean;
  dawnMinutes: number;
  torch: boolean;
};

type SmartAlarmNative = {
  startNight(targetAtMs: number, windowMinutes: number): Promise<{ exactAlarm: boolean }>;
  cancelNight(): Promise<void>;
  getStatus(): Promise<NightStatus>;
  getPermissions(): Promise<PermissionStatus>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  listNights(): Promise<string[]>;
  readNight(sessionId: string): Promise<string | null>;
  deleteNight(sessionId: string): Promise<void>;
  testRing(delaySeconds: number): Promise<void>;
  markSummarySeen(): Promise<void>;
  configureAuto(cfg: AutoConfig): Promise<AutoStatus>;
  getAutoStatus(): Promise<AutoStatus>;
  getWakeOptions(): Promise<WakeOptions>;
  setWakeOptions(partial: Partial<WakeOptions>): Promise<WakeOptions>;
  previewSound(id: string): Promise<void>;
  stopPreview(): Promise<void>;
};

const DISABLED_AUTO_STATUS: AutoStatus = {
  enabled: false,
  hour: 0,
  minute: 0,
  daysMask: 0,
  windowMinutes: 0,
  currentTargetMs: 0,
  usualBedMinute: 0,
  apiConfidence: 0,
};

const DEFAULT_WAKE_OPTIONS: WakeOptions = {
  sound: 'birds',
  rampSeconds: 60,
  dawnEnabled: true,
  dawnMinutes: 30,
  torch: false,
};

const fallback: SmartAlarmNative = {
  // Never pretend an alarm was armed when the native module is missing.
  startNight: async () => {
    throw new Error('SmartAlarm native module unavailable: no alarm was set');
  },
  cancelNight: async () => {},
  getStatus: async () => ({
    state: 'idle',
    sessionId: null,
    startedAtMs: 0,
    targetAtMs: 0,
    windowMinutes: 0,
    firedAtMs: 0,
    firedReason: null,
    epochCount: 0,
    lastActivity: 0,
    summarySeen: false,
  }),
  getPermissions: async () => ({
    exactAlarm: false,
    fullScreenIntent: false,
    notifications: false,
    ignoringBatteryOptimizations: false,
  }),
  openExactAlarmSettings: async () => {},
  openFullScreenIntentSettings: async () => {},
  requestIgnoreBatteryOptimizations: async () => {},
  listNights: async () => [],
  readNight: async () => null,
  deleteNight: async () => {},
  testRing: async () => {},
  markSummarySeen: async () => {},
  configureAuto: async () => ({ ...DISABLED_AUTO_STATUS }),
  getAutoStatus: async () => ({ ...DISABLED_AUTO_STATUS }),
  getWakeOptions: async () => ({ ...DEFAULT_WAKE_OPTIONS }),
  setWakeOptions: async () => ({ ...DEFAULT_WAKE_OPTIONS }),
  previewSound: async () => {},
  stopPreview: async () => {},
};

function loadNative(): SmartAlarmNative {
  try {
    return requireNativeModule<SmartAlarmNative>('SmartAlarm');
  } catch {
    return fallback;
  }
}

const native = loadNative();

export const startNight = (targetAtMs: number, windowMinutes: number) =>
  native.startNight(targetAtMs, windowMinutes);
export const cancelNight = () => native.cancelNight();
export const getStatus = () => native.getStatus();
export const getPermissions = () => native.getPermissions();
export const openExactAlarmSettings = () => native.openExactAlarmSettings();
export const openFullScreenIntentSettings = () => native.openFullScreenIntentSettings();
export const requestIgnoreBatteryOptimizations = () => native.requestIgnoreBatteryOptimizations();
export const listNights = () => native.listNights();
export const readNight = (sessionId: string) => native.readNight(sessionId);
export const deleteNight = (sessionId: string) => native.deleteNight(sessionId);
export const testRing = (delaySeconds: number) => native.testRing(delaySeconds);
export const markSummarySeen = () => native.markSummarySeen();
export const configureAuto = (cfg: AutoConfig) => native.configureAuto(cfg);
export const getAutoStatus = () => native.getAutoStatus();
export const getWakeOptions = () => native.getWakeOptions();
export const setWakeOptions = (partial: Partial<WakeOptions>) => native.setWakeOptions(partial);
export const previewSound = (id: string) => native.previewSound(id);
export const stopPreview = () => native.stopPreview();

export const isNativeAvailable = native !== fallback;

export const SmartAlarm = {
  startNight,
  cancelNight,
  getStatus,
  getPermissions,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  requestIgnoreBatteryOptimizations,
  listNights,
  readNight,
  deleteNight,
  testRing,
  markSummarySeen,
  configureAuto,
  getAutoStatus,
  getWakeOptions,
  setWakeOptions,
  previewSound,
  stopPreview,
};
