import { computeRMS, computeSpectralCentroid, computeSpectralFlux, detectSnoring, detectRegularBreathing } from '../audioFeatures';
import { computeAccelFeatures, detectMovement, computeMovementScore, createAccelBuffer, pushAccelData } from '../accelFeatures';

describe('audioFeatures', () => {
  describe('computeRMS', () => {
    it('should compute RMS correctly', () => {
      const samples = new Float32Array([0.1, -0.1, 0.1, -0.1]);
      const rms = computeRMS(samples);
      expect(rms).toBeCloseTo(0.1);
    });

    it('should return 0 for silence', () => {
      const samples = new Float32Array(100).fill(0);
      const rms = computeRMS(samples);
      expect(rms).toBe(0);
    });

    it('should compute RMS for random samples', () => {
      const samples = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        samples[i] = (Math.random() - 0.5) * 0.2;
      }
      const rms = computeRMS(samples);
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(0.2);
    });
  });

  describe('computeSpectralCentroid', () => {
    it('should compute spectral centroid', () => {
      const samples = new Float32Array(512).fill(0.1);
      const centroid = computeSpectralCentroid(samples);
      expect(centroid).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeSpectralFlux', () => {
    it('should return 0 for identical frames', () => {
      const current = new Float32Array(512).fill(0.1);
      const previous = new Float32Array(512).fill(0.1);
      const flux = computeSpectralFlux(current, previous);
      expect(flux).toBe(0);
    });

    it('should return positive value for different frames', () => {
      const current = new Float32Array(512).fill(0.2);
      const previous = new Float32Array(512).fill(0.1);
      const flux = computeSpectralFlux(current, previous);
      expect(flux).toBeGreaterThan(0);
    });

    it('should return 0 for null previous', () => {
      const current = new Float32Array(512).fill(0.1);
      const flux = computeSpectralFlux(current, null);
      expect(flux).toBe(0);
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

    it('should return false for insufficient history', () => {
      const features = Array(5).fill(null).map(() => ({
        rms: 0.02,
        spectralCentroid: 300,
        spectralFlux: 0.01,
        zeroCrossingRate: 0.05,
        lowFreqEnergy: 10,
        highFreqEnergy: 5,
        timestamp: Date.now(),
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
      expect(features.variance).toBeCloseTo(0);
    });

    it('should compute variance for varying data', () => {
      const buffer = createAccelBuffer();
      pushAccelData(buffer, 0.1, 0.1, 0.1);
      pushAccelData(buffer, 0.5, 0.5, 0.5);
      pushAccelData(buffer, 0.2, 0.2, 0.2);
      
      const features = computeAccelFeatures(buffer, Date.now());
      
      expect(features.variance).toBeGreaterThan(0);
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

    it('should detect movement from variance', () => {
      const features = { magnitude: 0.1, variance: 0.1, timestamp: Date.now() };
      expect(detectMovement(features, 0.15)).toBe(true);
    });
  });

  describe('computeMovementScore', () => {
    it('should compute score from history', () => {
      const history = Array(10).fill({ magnitude: 0.1, variance: 0.01, timestamp: Date.now() });
      // Put movement in the last 5 positions (indices 5-9)
      history[9] = { magnitude: 0.5, variance: 0.1, timestamp: Date.now() };
      
      const score = computeMovementScore(history);
      
      expect(score).toBe(0.2); // 1 movement out of 5 (last 5)
    });

    it('should return 0 for empty history', () => {
      const score = computeMovementScore([]);
      expect(score).toBe(0);
    });

    it('should return 0 for insufficient history', () => {
      const score = computeMovementScore([{ magnitude: 0.1, variance: 0.01, timestamp: Date.now() }]);
      expect(score).toBe(0);
    });
  });
});