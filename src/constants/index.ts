export const SLEEP_CYCLE_LENGTH = 90 * 60 * 1000;
export const DEFAULT_FALL_ASLEEP_TIME = 15 * 60 * 1000;
export const WAKE_WINDOW_DURATION = 90 * 60 * 1000;
export const EPOCH_DURATION = 30 * 1000;
export const LIGHT_SLEEP_DETECTION_WINDOW = 5 * 60 * 1000;

export const NATURE_SOUNDS: { id: string; name: string; file: string }[] = [
  { id: 'birds', name: 'Oiseaux matinaux', file: 'birds.mp3' },
  { id: 'waves', name: 'Vagues océan', file: 'waves.mp3' },
  { id: 'rain', name: 'Pluie douce', file: 'rain.mp3' },
  { id: 'forest', name: 'Forêt', file: 'forest.mp3' },
  { id: 'stream', name: 'Ruisseau', file: 'stream.mp3' },
];

export const STORAGE_KEYS = {
  USER_PROFILE: '@smart_clock/user_profile',
  ALARMS: '@smart_clock/alarms',
  SLEEP_HISTORY: '@smart_clock/sleep_history',
  SETTINGS: '@smart_clock/settings',
} as const;

export const NOTIFICATION_CHANNELS = {
  ALARM: 'smart_clock_alarm',
  BEDTIME_REMINDER: 'smart_clock_bedtime',
  SLEEP_TRACKING: 'smart_clock_sleep_tracking',
} as const;

export const PERMISSIONS = {
  AUDIO_RECORDING: 'audioRecording',
  NOTIFICATIONS: 'notifications',
  BLUETOOTH: 'bluetooth',
  FOREGROUND_SERVICE: 'foregroundService',
} as const;