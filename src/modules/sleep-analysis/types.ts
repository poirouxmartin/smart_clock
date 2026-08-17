export interface AudioFeatures {
  rms: number;
  spectralCentroid: number;
  spectralFlux: number;
  zeroCrossingRate: number;
  lowFreqEnergy: number;
  highFreqEnergy: number;
  timestamp: number;
}

export interface AccelFeatures {
  magnitude: number;
  variance: number;
  timestamp: number;
}

export interface SleepEpochFeatures {
  timestamp: number;
  audio: AudioFeatures;
  accel: AccelFeatures;
  lightSleepScore: number;
  movementDetected: boolean;
  snoringDetected: boolean;
  regularBreathing: boolean;
}

export interface LightSleepDetectionConfig {
  epochDurationMs: number;
  detectionWindowMs: number;
  minLightSleepDurationMs: number;
  rmsThreshold: number;
  accelThreshold: number;
  spectralFluxThreshold: number;
  breathingRegularityThreshold: number;
  adaptiveLearning: boolean;
}

export const DEFAULT_CONFIG: LightSleepDetectionConfig = {
  epochDurationMs: 30 * 1000,
  detectionWindowMs: 5 * 60 * 1000,
  minLightSleepDurationMs: 3 * 60 * 1000,
  rmsThreshold: 0.015,
  accelThreshold: 0.15,
  spectralFluxThreshold: 0.05,
  breathingRegularityThreshold: 0.7,
  adaptiveLearning: true,
};

export interface WakeTriggerResult {
  shouldWake: boolean;
  confidence: number;
  reason: string;
  optimalWakeTime: number;
}