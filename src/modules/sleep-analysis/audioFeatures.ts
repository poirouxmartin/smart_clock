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

// In-place iterative radix-2 FFT. re/im length must be a power of two.
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const wRe = Math.cos((-2 * Math.PI) / len);
    const wIm = Math.sin((-2 * Math.PI) / len);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tRe = re[b] * curRe - im[b] * curIm;
        const tIm = re[b] * curIm + im[b] * curRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// Magnitudes of bins 0..size/2-1 where size = next power of two >= samples.length (zero-padded).
// Replaces an O(n^2) DFT that cost ~1e8 sin/cos calls per 1 s audio chunk.
function magnitudeSpectrum(samples: Float32Array): { magnitudes: Float64Array; size: number } {
  let size = 1;
  while (size < samples.length) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(samples);
  fftInPlace(re, im);
  const magnitudes = new Float64Array(size / 2);
  for (let k = 0; k < magnitudes.length; k++) {
    magnitudes[k] = Math.hypot(re[k], im[k]);
  }
  return { magnitudes, size };
}

export function computeSpectralCentroid(samples: Float32Array, sampleRate: number = SAMPLE_RATE): number {
  const { magnitudes, size } = magnitudeSpectrum(samples);

  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    const freq = k * sampleRate / size;
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
  const { magnitudes, size } = magnitudeSpectrum(samples);
  const freqsPerBin = sampleRate / size;
  const lowBin = Math.max(0, Math.floor(lowFreq / freqsPerBin));
  const highBin = Math.min(Math.floor(highFreq / freqsPerBin), magnitudes.length - 1);

  let energy = 0;
  for (let k = lowBin; k <= highBin; k++) {
    energy += magnitudes[k] * magnitudes[k];
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