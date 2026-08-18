import { SleepAnalyzer, createSleepAnalyzer } from '../SleepAnalyzer';
import { computeRMS, computeSpectralCentroid, computeSpectralFlux, detectSnoring, detectRegularBreathing } from '../audioFeatures';
import { computeAccelFeatures, detectMovement, computeMovementScore, createAccelBuffer, pushAccelData } from '../accelFeatures';
import { LightSleepDetectionConfig, SleepEpochFeatures } from '../types';

describe('SleepAnalyzer', () => {
  let analyzer: ReturnType<typeof createSleepAnalyzer>;

  beforeEach(() => {
    analyzer = createSleepAnalyzer({ adaptiveLearning: false });
  });

  describe('processAudioChunk', () => {
    it('should process audio chunk and return features', () => {
      const samples = new Float32Array(16000).fill(0.01);
      const timestamp = Date.now();
      
      const features = analyzer.processAudioChunk(samples, timestamp);
      
      expect(features).toBeDefined();
      expect(features.timestamp).toBe(timestamp);
      expect(features.rms).toBeGreaterThan(0);
      expect(features.spectralCentroid).toBeGreaterThanOrEqual(0);
    });

    it('should detect low RMS as quiet', () => {
      const quietSamples = new Float32Array(16000).fill(0.001);
      const features = analyzer.processAudioChunk(quietSamples, Date.now());
      
      expect(features.rms).toBeLessThan(0.01);
    });

    it('should detect high RMS as loud', () => {
      const loudSamples = new Float32Array(16000).fill(0.1);
      const features = analyzer.processAudioChunk(loudSamples, Date.now());
      
      expect(features.rms).toBeGreaterThan(0.05);
    });
  });

  describe('processAccelData', () => {
    it('should process accelerometer data', () => {
      const timestamp = Date.now();
      const features = analyzer.processAccelData(0.1, 0.05, 0.98, timestamp);
      
      expect(features).toBeDefined();
      expect(features.timestamp).toBe(timestamp);
      expect(features.magnitude).toBeGreaterThan(0);
    });

    it('should detect movement above threshold', () => {
      const features = analyzer.processAccelData(0.5, 0.3, 0.2, Date.now());
      expect(features.magnitude).toBeGreaterThan(0.5);
    });
  });

  describe('computeEpochFeatures', () => {
    it('should compute epoch features combining audio and accel', () => {
      // Add some audio data
      const audioSamples = new Float32Array(16000).fill(0.02);
      analyzer.processAudioChunk(audioSamples, Date.now());
      
      // Add some accel data
      analyzer.processAccelData(0.1, 0.05, 0.98, Date.now());
      
      const epoch = analyzer.computeEpochFeatures(Date.now());
      
      expect(epoch).toBeDefined();
      expect(epoch.lightSleepScore).toBeGreaterThanOrEqual(0);
      expect(epoch.lightSleepScore).toBeLessThanOrEqual(1);
      expect(typeof epoch.movementDetected).toBe('boolean');
      expect(typeof epoch.snoringDetected).toBe('boolean');
      expect(typeof epoch.regularBreathing).toBe('boolean');
    });
  });

  describe('checkWakeTrigger', () => {
    it('should not trigger before window start', () => {
      const now = Date.now();
      const windowStart = now + 60 * 60 * 1000; // 1 hour in future
      const windowEnd = windowStart + 90 * 60 * 1000;
      
      const result = analyzer.checkWakeTrigger(windowStart, windowEnd, now);
      
      expect(result.shouldWake).toBe(false);
      expect(result.reason).toBe('Avant fenêtre');
    });

    it('should trigger at window end (fallback)', () => {
      const now = Date.now();
      const windowStart = now - 100 * 60 * 1000;
      const windowEnd = now - 1000; // Just passed
      
      const result = analyzer.checkWakeTrigger(windowStart, windowEnd, now);
      
      expect(result.shouldWake).toBe(true);
      expect(result.confidence).toBe(1);
      expect(result.reason).toContain('Fin de fenêtre');
    });
  });

  describe('reset', () => {
    it('should clear all history', () => {
      analyzer.processAudioChunk(new Float32Array(16000).fill(0.01), Date.now());
      analyzer.processAccelData(0.1, 0.1, 0.1, Date.now());
      analyzer.computeEpochFeatures(Date.now());
      
      analyzer.reset();
      
      expect(analyzer.getEpochHistory().length).toBe(0);
      expect(analyzer.getAudioHistory().length).toBe(0);
      expect(analyzer.getAccelHistory().length).toBe(0);
    });
  });

  describe('exportData', () => {
    it('should export JSON data', () => {
      analyzer.processAudioChunk(new Float32Array(16000).fill(0.01), Date.now());
      analyzer.processAccelData(0.1, 0.1, 0.1, Date.now());
      analyzer.computeEpochFeatures(Date.now());
      
      const json = analyzer.exportData();
      const data = JSON.parse(json);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('t');
      expect(data[0]).toHaveProperty('rms');
      expect(data[0]).toHaveProperty('accel');
    });
  });
});

describe('audioFeatures', () => {
  describe('computeRMS', () => {
    it('should compute RMS correctly', () => {
      const samples = new Float32Array([0.1, -0.1, 0.1, -0.1]);
      const rms = computeRMS(samples);
      expect(rms).toBe(0.1);
    });

    it('should return 0 for silence', () => {
      const samples = new Float32Array(100).fill(0);
      const rms = computeRMS(samples);
      expect(rms).toBe(0);
    });
  });

  describe('detectSnoring', () => {
    it('should detect snoring from low freq energy', () => {
      const features = {
        rms: 0.05,
        spectralCentroid: 200,
        spectralFlux: 0.01,
        zeroCrossingRate: 0.05,
        lowFreqEnergy: 100,
        highFreqEnergy: 10,
        timestamp: Date.now(),
      };
      
      expect(detectSnoring(features)).toBe(true);
    });

    it('should not detect snoring for normal speech', () => {
      const features = {
        rms: 0.02,
        spectralCentroid: 1000,
        spectralFlux: 0.1,
        zeroCrossingRate: 0.1,
        lowFreqEnergy: 10,
        highFreqEnergy: 100,
        timestamp: Date.now(),
      };
      
      expect(detectSnoring(features)).toBe(false);
    });
  });

  describe('detectRegularBreathing', () => {
    it('should detect regular breathing from low CV', () => {
      const features = Array(20).fill(null).map((_, i) => ({
        rms: 0.02 + Math.sin(i * 0.5) * 0.002,
        spectralCentroid: 300,
        spectralFlux: 0.01,
        zeroCrossingRate: 0.05,
        lowFreqEnergy: 10,
        highFreqEnergy: 5,
        timestamp: Date.now() + i * 1000,
      }));
      
      expect(detectRegularBreathing(features)).toBe(true);
    });

    it('should not detect irregular breathing', () => {
      const features = Array(20).fill(null).map((_, i) => ({
        rms: Math.random() * 0.1,
        spectralCentroid: 300,
        spectralFlux: 0.1,
        zeroCrossingRate: 0.1,
        lowFreqEnergy: 10,
        highFreqEnergy: 5,
        timestamp: Date.now() + i * 1000,
      }));
      
      expect(detectRegularBreathing(features)).toBe(false);
    });
  });
});

describe('accelFeatures', () => {
  describe('createAccelBuffer', () => {
    it('should create empty buffer', () => {
      const buffer = createAccelBuffer();
      expect(buffer.x).toEqual([]);
      expect(buffer.y).toEqual([]);
      expect(buffer.z).toEqual([]);
      expect(buffer.magnitude).toEqual([]);
    });
  });

  describe('pushAccelData', () => {
    it('should add data to buffer', () => {
      const buffer = createAccelBuffer();
      pushAccelData(buffer, 0.1, 0.2, 0.3);
      
      expect(buffer.x.length).toBe(1);
      expect(buffer.magnitude.length).toBe(1);
      expect(buffer.magnitude[0]).toBeCloseTo(Math.sqrt(0.1**2 + 0.2**2 + 0.3**2));
    });

    it('should maintain max size', () => {
      const buffer = createAccelBuffer();
      for (let i = 0; i < 150; i++) {
        pushAccelData(buffer, 0.1, 0.1, 0.1);
      }
      
      expect(buffer.magnitude.length).toBe(100);
    });
  });

  describe('computeAccelFeatures', () => {
    it('should compute magnitude and variance', () => {
      const buffer = createAccelBuffer();
      for (let i = 0; i < 10; i++) {
        pushAccelData(buffer, 0.1, 0.1, 0.1);
      }
      
      const features = computeAccelFeatures(buffer, Date.now());
      
      expect(features.magnitude).toBeCloseTo(Math.sqrt(0.03));
      expect(features.variance).toBe(0);
    });
  });

  describe('detectMovement', () => {
    it('should detect movement above threshold', () => {
      const features = { magnitude: 0.5, variance: 0.1, timestamp: Date.now() };
      expect(detectMovement(features, 0.15)).toBe(true);
    });

    it('should not detect movement below threshold', () => {
      const features = { magnitude: 0.05, variance: 0.01, timestamp: Date.now() };
      expect(detectMovement(features, 0.15)).toBe(false);
    });
  });
});