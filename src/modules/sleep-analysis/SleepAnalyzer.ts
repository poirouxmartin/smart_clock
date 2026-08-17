import {
  LightSleepDetectionConfig,
  DEFAULT_CONFIG,
  AudioFeatures,
  AccelFeatures,
  SleepEpochFeatures,
  WakeTriggerResult,
} from './types';
import { extractAudioFeatures, detectSnoring, detectRegularBreathing } from './audioFeatures';
import { computeAccelFeatures, detectMovement, computeMovementScore } from './accelFeatures';

export class SleepAnalyzer {
  private config: LightSleepDetectionConfig;
  private audioHistory: AudioFeatures[] = [];
  private accelHistory: AccelFeatures[] = [];
  private epochHistory: SleepEpochFeatures[] = [];
  private previousAudioSamples: Float32Array | null = null;
  private accelBuffer = { x: [] as number[], y: [] as number[], z: [] as number[], magnitude: [] as number[] };
  private userBaseline: { rms: number; accel: number } | null = null;

  constructor(config: Partial<LightSleepDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<LightSleepDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  processAudioChunk(samples: Float32Array, timestamp: number): AudioFeatures {
    const features = extractAudioFeatures(samples, this.previousAudioSamples, timestamp);
    this.previousAudioSamples = samples;
    
    this.audioHistory.push(features);
    if (this.audioHistory.length > 300) this.audioHistory.shift();
    
    this.updateBaseline(features);
    return features;
  }

  processAccelData(x: number, y: number, z: number, timestamp: number): AccelFeatures {
    const ACCEL_WINDOW_SIZE = 100;
    this.accelBuffer.x.push(x);
    this.accelBuffer.y.push(y);
    this.accelBuffer.z.push(z);
    this.accelBuffer.magnitude.push(Math.sqrt(x * x + y * y + z * z));
    
    if (this.accelBuffer.magnitude.length > ACCEL_WINDOW_SIZE) {
      this.accelBuffer.x.shift();
      this.accelBuffer.y.shift();
      this.accelBuffer.z.shift();
      this.accelBuffer.magnitude.shift();
    }

    const features = computeAccelFeatures(this.accelBuffer, timestamp);
    this.accelHistory.push(features);
    if (this.accelHistory.length > 300) this.accelHistory.shift();
    
    this.updateBaseline(undefined, features);
    return features;
  }

  private updateBaseline(audio?: AudioFeatures, accel?: AccelFeatures): void {
    if (!this.config.adaptiveLearning) return;
    
    if (audio && this.audioHistory.length > 50) {
      const recent = this.audioHistory.slice(-50);
      const rmsValues = recent.map(f => f.rms).sort((a, b) => a - b);
      const medianRms = rmsValues[Math.floor(rmsValues.length / 2)];
      
      if (!this.userBaseline || medianRms < this.userBaseline.rms) {
        this.userBaseline = { ...this.userBaseline, rms: medianRms };
      }
    }
    
    if (accel && this.accelHistory.length > 50) {
      const recent = this.accelHistory.slice(-50);
      const magValues = recent.map(f => f.magnitude).sort((a, b) => a - b);
      const medianAccel = magValues[Math.floor(magValues.length / 2)];
      
      if (!this.userBaseline || medianAccel < this.userBaseline.accel) {
        this.userBaseline = { ...this.userBaseline, accel: medianAccel };
      }
    }
  }

  computeEpochFeatures(timestamp: number): SleepEpochFeatures {
    const audio = this.audioHistory[this.audioHistory.length - 1];
    const accel = this.accelHistory[this.accelHistory.length - 1];
    
    if (!audio || !accel) {
      return this.createEmptyEpoch(timestamp);
    }

    const movementDetected = detectMovement(accel, this.getAdaptiveAccelThreshold());
    const snoringDetected = detectSnoring(audio);
    const regularBreathing = detectRegularBreathing(this.audioHistory.slice(-20));
    const movementScore = computeMovementScore(this.accelHistory.slice(-10));
    
    const lightSleepScore = this.computeLightSleepScore(
      audio,
      accel,
      movementDetected,
      snoringDetected,
      regularBreathing,
      movementScore
    );

    const epoch: SleepEpochFeatures = {
      timestamp,
      audio,
      accel,
      lightSleepScore,
      movementDetected,
      snoringDetected,
      regularBreathing,
    };

    this.epochHistory.push(epoch);
    if (this.epochHistory.length > 200) this.epochHistory.shift();

    return epoch;
  }

  private getAdaptiveAccelThreshold(): number {
    if (this.userBaseline?.accel) {
      return Math.max(this.config.accelThreshold, this.userBaseline.accel * 3);
    }
    return this.config.accelThreshold;
  }

  private getAdaptiveRmsThreshold(): number {
    if (this.userBaseline?.rms) {
      return Math.max(this.config.rmsThreshold, this.userBaseline.rms * 2);
    }
    return this.config.rmsThreshold;
  }

  private computeLightSleepScore(
    audio: AudioFeatures,
    accel: AccelFeatures,
    movementDetected: boolean,
    snoringDetected: boolean,
    regularBreathing: boolean,
    movementScore: number
  ): number {
    let score = 0;
    const rmsThreshold = this.getAdaptiveRmsThreshold();

    if (audio.rms < rmsThreshold) score += 0.3;
    if (accel.magnitude < this.getAdaptiveAccelThreshold()) score += 0.2;
    if (!movementDetected) score += 0.2;
    if (regularBreathing) score += 0.2;
    if (!snoringDetected) score += 0.1;
    if (audio.spectralFlux < this.config.spectralFluxThreshold) score += 0.1;
    if (movementScore < 0.2) score += 0.1;

    return Math.min(1, Math.max(0, score));
  }

  private createEmptyEpoch(timestamp: number): SleepEpochFeatures {
    return {
      timestamp,
      audio: { rms: 0, spectralCentroid: 0, spectralFlux: 0, zeroCrossingRate: 0, lowFreqEnergy: 0, highFreqEnergy: 0, timestamp },
      accel: { magnitude: 0, variance: 0, timestamp },
      lightSleepScore: 0,
      movementDetected: false,
      snoringDetected: false,
      regularBreathing: false,
    };
  }

  checkWakeTrigger(windowStart: number, windowEnd: number, currentTime: number): WakeTriggerResult {
    if (currentTime >= windowEnd) {
      return {
        shouldWake: true,
        confidence: 1,
        reason: 'Fin de fenêtre de réveil',
        optimalWakeTime: windowEnd,
      };
    }

    if (currentTime < windowStart) {
      return { shouldWake: false, confidence: 0, reason: 'Avant fenêtre', optimalWakeTime: windowStart };
    }

    const windowEpochs = this.epochHistory.filter(e => e.timestamp >= windowStart && e.timestamp <= currentTime);
    if (windowEpochs.length < 5) {
      return { shouldWake: false, confidence: 0, reason: 'Pas assez de données', optimalWakeTime: currentTime };
    }

    const lightSleepEpochs = windowEpochs.filter(e => e.lightSleepScore > 0.6);
    const consecutiveLight = this.getMaxConsecutiveLightSleep(lightSleepEpochs);

    if (consecutiveLight >= this.config.minLightSleepDurationMs / this.config.epochDurationMs) {
      const lastLightEpoch = lightSleepEpochs[lightSleepEpochs.length - 1];
      return {
        shouldWake: true,
        confidence: lastLightEpoch.lightSleepScore,
        reason: `Phase légère détectée (${consecutiveLight} epochs consécutifs)`,
        optimalWakeTime: lastLightEpoch.timestamp,
      };
    }

    const recentEpochs = this.epochHistory.slice(-10);
    const avgScore = recentEpochs.reduce((a, b) => a + b.lightSleepScore, 0) / recentEpochs.length;
    
    if (avgScore > 0.7 && currentTime > windowStart + this.config.detectionWindowMs * 0.5) {
      return {
        shouldWake: true,
        confidence: avgScore,
        reason: 'Score phase légère élevé maintenu',
        optimalWakeTime: currentTime,
      };
    }

    return { shouldWake: false, confidence: 0, reason: 'Pas de phase légère détectée', optimalWakeTime: currentTime };
  }

  private getMaxConsecutiveLightSleep(epochs: SleepEpochFeatures[]): number {
    let max = 0;
    let current = 0;
    for (const epoch of epochs) {
      if (epoch.lightSleepScore > 0.6) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    return max;
  }

  getEpochHistory(): SleepEpochFeatures[] {
    return [...this.epochHistory];
  }

  getAudioHistory(): AudioFeatures[] {
    return [...this.audioHistory];
  }

  getAccelHistory(): AccelFeatures[] {
    return [...this.accelHistory];
  }

  reset(): void {
    this.audioHistory = [];
    this.accelHistory = [];
    this.epochHistory = [];
    this.previousAudioSamples = null;
    this.accelBuffer = { x: [], y: [], z: [], magnitude: [] };
  }

  exportData(): string {
    const epochs = this.epochHistory.map(e => ({
      t: e.timestamp,
      rms: e.audio.rms,
      accel: e.accel.magnitude,
      score: e.lightSleepScore,
      move: e.movementDetected ? 1 : 0,
      snore: e.snoringDetected ? 1 : 0,
      breath: e.regularBreathing ? 1 : 0,
    }));
    return JSON.stringify(epochs, null, 2);
  }
}

export function createSleepAnalyzer(config?: Partial<LightSleepDetectionConfig>): SleepAnalyzer {
  return new SleepAnalyzer(config);
}