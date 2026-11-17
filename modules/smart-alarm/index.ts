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
  lastSamples: number;
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
  skippedTargetMs: number;
  upcomingNotif: boolean;
  usualBedMinute: number;
  apiConfidence: number;
};

export type WakeSound = 'birds' | 'waves' | 'forest' | 'rain' | 'stream' | 'storm';

export interface WakeLogEntry {
  atMs: number;
  reason: string;
  requested: string;
  played: string;
  player: 'mediaplayer' | 'ringtone' | 'none' | string;
  error: string;
  rampSeconds: number;
  appVersion: string;
}

export type WakeOptions = {
  sound: WakeSound;
  rampSeconds: number;
  dawnEnabled: boolean;
  dawnMinutes: number;
  torch: boolean;
};

export interface RingState {
  ringing: boolean;
  reason: string;
  snoozeUntilMs: number;
}

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
  skipNextAuto(): Promise<AutoStatus>;
  unskipAuto(): Promise<AutoStatus>;
  setUpcomingNotification(enabled: boolean): Promise<AutoStatus>;
  getWakeOptions(): Promise<WakeOptions>;
  setWakeOptions(partial: Partial<WakeOptions>): Promise<WakeOptions>;
  previewSound(id: string): Promise<void>;
  stopPreview(): Promise<void>;
  getWakeLog(): Promise<string>;
  getAppVersion(): Promise<string>;
  getVersionInfo(): Promise<VersionInfo>;
  downloadAndInstallUpdate(url: string, expectedVersion: string): Promise<string>;
  getRingState(): Promise<RingState>;
  stopRing(): Promise<void>;
  snoozeRing(): Promise<void>;
};

export type UpdateInstallResult = 'started' | 'need_permission' | 'bad_url' | 'download_failed' | 'bad_apk' | 'not_newer';

const DISABLED_AUTO_STATUS: AutoStatus = {
  enabled: false,
  hour: 0,
  minute: 0,
  daysMask: 0,
  windowMinutes: 0,
  currentTargetMs: 0,
  skippedTargetMs: 0,
  upcomingNotif: true,
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
    lastSamples: 0,
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
  skipNextAuto: async () => ({ ...DISABLED_AUTO_STATUS }),
  unskipAuto: async () => ({ ...DISABLED_AUTO_STATUS }),
  setUpcomingNotification: async () => ({ ...DISABLED_AUTO_STATUS }),
  getWakeOptions: async () => ({ ...DEFAULT_WAKE_OPTIONS }),
  setWakeOptions: async () => ({ ...DEFAULT_WAKE_OPTIONS }),
  previewSound: async () => {},
  stopPreview: async () => {},
  getWakeLog: async () => '[]',
  getAppVersion: async () => '?',
  getVersionInfo: async () => ({ versionName: '0.0.0', versionCode: 0, releasesApiUrl: '', apkUrlPrefix: '' }),
  downloadAndInstallUpdate: async () => 'bad_url',
  getRingState: async () => ({ ringing: false, reason: '', snoozeUntilMs: 0 }),
  stopRing: async () => {},
  snoozeRing: async () => {},
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
export const skipNextAuto = () => native.skipNextAuto();
export const unskipAuto = () => native.unskipAuto();
export const setUpcomingNotification = (enabled: boolean) => native.setUpcomingNotification(enabled);
export const getWakeOptions = () => native.getWakeOptions();
export const setWakeOptions = (partial: Partial<WakeOptions>) => native.setWakeOptions(partial);
export const previewSound = (id: string) => native.previewSound(id);
export const stopPreview = () => native.stopPreview();
export const getWakeLog = async (): Promise<WakeLogEntry[]> => {
  try {
    const parsed = JSON.parse(await native.getWakeLog());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export const getAppVersion = () => native.getAppVersion();
export const getRingState = () => native.getRingState();
export const stopRing = () => native.stopRing();
export const snoozeRing = () => native.snoozeRing();
/** Installed version and where its releases are checked (AppUpdater.RELEASES_REPO). */
export interface VersionInfo {
  versionName: string;
  versionCode: number;
  releasesApiUrl: string;
  apkUrlPrefix: string;
}
export const getVersionInfo = () => native.getVersionInfo();
export const downloadAndInstallUpdate = (url: string, expectedVersion: string) =>
  native.downloadAndInstallUpdate(url, expectedVersion) as Promise<UpdateInstallResult>;

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
  skipNextAuto,
  unskipAuto,
  setUpcomingNotification,
  getWakeOptions,
  setWakeOptions,
  previewSound,
  stopPreview,
  getWakeLog,
  getAppVersion,
  getRingState,
  stopRing,
  snoozeRing,
  getVersionInfo,
  downloadAndInstallUpdate,
};
