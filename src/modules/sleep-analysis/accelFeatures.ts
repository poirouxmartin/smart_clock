import { AccelFeatures } from './types';

const ACCEL_WINDOW_SIZE = 100;

export interface AccelBuffer {
  x: number[];
  y: number[];
  z: number[];
  magnitude: number[];
}

export function createAccelBuffer(): AccelBuffer {
  return { x: [], y: [], z: [], magnitude: [] };
}

export function pushAccelData(buffer: AccelBuffer, x: number, y: number, z: number): void {
  buffer.x.push(x);
  buffer.y.push(y);
  buffer.z.push(z);
  buffer.magnitude.push(Math.sqrt(x * x + y * y + z * z));
  
  if (buffer.magnitude.length > ACCEL_WINDOW_SIZE) {
    buffer.x.shift();
    buffer.y.shift();
    buffer.z.shift();
    buffer.magnitude.shift();
  }
}

export function computeAccelFeatures(buffer: AccelBuffer, timestamp: number): AccelFeatures {
  const mag = buffer.magnitude;
  if (mag.length === 0) {
    return { magnitude: 0, variance: 0, timestamp };
  }

  const mean = mag.reduce((a, b) => a + b, 0) / mag.length;
  const variance = mag.reduce((a, b) => a + (b - mean) ** 2, 0) / mag.length;
  const currentMagnitude = mag[mag.length - 1];

  return {
    magnitude: currentMagnitude,
    variance,
    timestamp,
  };
}

export function detectMovement(features: AccelFeatures, threshold: number = 0.15): boolean {
  return features.magnitude > threshold || features.variance > threshold * 0.5;
}

export function computeMovementScore(featuresHistory: AccelFeatures[]): number {
  if (featuresHistory.length < 5) return 0;
  
  const recent = featuresHistory.slice(-5);
  const movements = recent.filter(f => detectMovement(f)).length;
  return movements / recent.length;
}