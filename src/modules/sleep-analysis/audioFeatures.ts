import { AudioFeatures } from './types';

const SAMPLE_RATE = 16000;
const FRAME_SIZE = 512;
const HOP_SIZE = 256;

export function computeRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

export function computeZeroCrossingRate(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / samples.length;
}

export function computeSpectralCentroid(samples: Float32Array, sampleRate: number = SAMPLE_RATE): number {
  const n = samples.length;
  const magnitudes = new Float32Array(n / 2);
  
  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real += samples[t] * Math.cos(angle);
      imag += samples[t] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag);
  }

  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    const freq = k * sampleRate / n;
    weightedSum += freq * magnitudes[k];
    magnitudeSum += magnitudes[k];
  }
  
  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
}

export function computeSpectralFlux(current: Float32Array, previous: Float32Array | null): number {
  if (!previous || current.length !== previous.length) return 0;
  
  let flux = 0;
  for (let i = 0; i < current.length; i++) {
    const diff = current[i] - previous[i];
    flux += diff > 0 ? diff : 0;
  }
  return flux / current.length;
}

export function computeBandEnergy(samples: Float32Array, lowFreq: number, highFreq: number, sampleRate: number = SAMPLE_RATE): number {
  const n = samples.length;
  const freqsPerBin = sampleRate / n;
  const lowBin = Math.floor(lowFreq / freqsPerBin);
  const highBin = Math.min(Math.floor(highFreq / freqsPerBin), n / 2);
  
  let energy = 0;
  for (let k = lowBin; k <= highBin; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real += samples[t] * Math.cos(angle);
      imag += samples[t] * Math.sin(angle);
    }
    energy += real * real + imag * imag;
  }
  return energy;
}

export function extractAudioFeatures(
  samples: Float32Array,
  previousSamples: Float32Array | null,
  timestamp: number
): AudioFeatures {
  const rms = computeRMS(samples);
  const spectralCentroid = computeSpectralCentroid(samples);
  const spectralFlux = computeSpectralFlux(samples, previousSamples);
  const zeroCrossingRate = computeZeroCrossingRate(samples);
  const lowFreqEnergy = computeBandEnergy(samples, 20, 200);
  const highFreqEnergy = computeBandEnergy(samples, 200, 4000);

  return {
    rms,
    spectralCentroid,
    spectralFlux,
    zeroCrossingRate,
    lowFreqEnergy,
    highFreqEnergy,
    timestamp,
  };
}

export function detectSnoring(features: AudioFeatures): boolean {
  return features.lowFreqEnergy > features.highFreqEnergy * 3 &&
         features.spectralCentroid < 300 &&
         features.rms > 0.02;
}

export function detectRegularBreathing(featuresHistory: AudioFeatures[]): boolean {
  if (featuresHistory.length < 10) return false;
  
  const rmsValues = featuresHistory.map(f => f.rms);
  const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  const variance = rmsValues.reduce((a, b) => a + (b - mean) ** 2, 0) / rmsValues.length;
  const cv = Math.sqrt(variance) / mean;
  
  return cv < 0.3 && mean > 0.005 && mean < 0.05;
}