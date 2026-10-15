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
};
