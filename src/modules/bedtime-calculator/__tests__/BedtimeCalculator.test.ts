import { BedtimeCalculator, createBedtimeCalculator } from '../BedtimeCalculator';
import { BedtimeCalculationInput, DEFAULT_SLEEP_CYCLE_LENGTH, DEFAULT_FALL_ASLEEP_DURATION } from '../types';

describe('BedtimeCalculator', () => {
  let calculator: ReturnType<typeof createBedtimeCalculator>;

  beforeEach(() => {
    calculator = createBedtimeCalculator();
  });

  describe('calculate', () => {
    it('should calculate ideal bedtime for 8h wake with 5 cycles', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const input: BedtimeCalculationInput = {
        targetWakeTime: wakeTime,
        sleepCycleLength: DEFAULT_SLEEP_CYCLE_LENGTH,
        desiredCycles: 5,
        fallAsleepDuration: DEFAULT_FALL_ASLEEP_DURATION,
        chronotype: 'intermediate',
      };
      
      const result = calculator.calculate(input);
      
      // 5 cycles * 90min = 450min + 15min fall asleep = 465min = 7h45min
      // 08:00 - 7h45 = 00:15
      expect(result.idealBedtime).toBe(wakeTime - 7.75 * 60 * 60 * 1000);
      expect(result.cycles).toBe(5);
      expect(result.totalSleepTime).toBe(5 * DEFAULT_SLEEP_CYCLE_LENGTH + DEFAULT_FALL_ASLEEP_DURATION);
      expect(result.fallAsleepEnd).toBe(result.idealBedtime + DEFAULT_FALL_ASLEEP_DURATION);
    });

    it('should adjust for morning chronotype', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const morningInput: BedtimeCalculationInput = {
        targetWakeTime: wakeTime,
        sleepCycleLength: DEFAULT_SLEEP_CYCLE_LENGTH,
        desiredCycles: 5,
        fallAsleepDuration: DEFAULT_FALL_ASLEEP_DURATION,
        chronotype: 'morning',
      };
      
      const intermediateInput: BedtimeCalculationInput = {
        ...morningInput,
        chronotype: 'intermediate',
      };
      
      const morningResult = calculator.calculate(morningInput);
      const intermediateResult = calculator.calculate(intermediateInput);
      
      // Morning chronotype: shorter cycles (-5min) + faster fall asleep (-5min) = 10min LESS total sleep
      // = LATER bedtime (closer to wake time)
      expect(morningResult.idealBedtime).toBeGreaterThan(intermediateResult.idealBedtime);
    });

    it('should adjust for evening chronotype', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const eveningInput: BedtimeCalculationInput = {
        targetWakeTime: wakeTime,
        sleepCycleLength: DEFAULT_SLEEP_CYCLE_LENGTH,
        desiredCycles: 5,
        fallAsleepDuration: DEFAULT_FALL_ASLEEP_DURATION,
        chronotype: 'evening',
      };
      
      const intermediateInput: BedtimeCalculationInput = {
        ...eveningInput,
        chronotype: 'intermediate',
      };
      
      const eveningResult = calculator.calculate(eveningInput);
      const intermediateResult = calculator.calculate(intermediateInput);
      
      // Evening chronotype: longer cycles (+10min) + slower fall asleep (+10min) = 20min MORE total sleep
      // = EARLIER bedtime (further from wake time)
      expect(eveningResult.idealBedtime).toBeLessThan(intermediateResult.idealBedtime);
    });

    it('should clamp cycles between 3 and 6', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const lowCycles = calculator.calculate({
        targetWakeTime: wakeTime,
        desiredCycles: 1,
        chronotype: 'intermediate',
      });
      
      const highCycles = calculator.calculate({
        targetWakeTime: wakeTime,
        desiredCycles: 10,
        chronotype: 'intermediate',
      });
      
      expect(lowCycles.cycles).toBe(3);
      expect(highCycles.cycles).toBe(6);
    });

    it('should generate alternative bedtimes', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const result = calculator.calculate({
        targetWakeTime: wakeTime,
        desiredCycles: 5,
        chronotype: 'intermediate',
      });
      
      expect(result.alternativeBedtimes.length).toBeGreaterThan(0);
      expect(result.alternativeBedtimes.every(a => a.cycles >= 3 && a.cycles <= 6)).toBe(true);
    });

    it('should detect wake at cycle boundary', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      const fallAsleepEnd = wakeTime - 5 * 90 * 60 * 1000; // Exactly 5 cycles
      
      const result = calculator.calculate({
        targetWakeTime: wakeTime,
        sleepCycleLength: 90 * 60 * 1000,
        desiredCycles: 5,
        fallAsleepDuration: 0, // No fall asleep time for exact test
        chronotype: 'intermediate',
      });
      
      expect(result.wakeUpAtEndOfCycle).toBe(true);
    });

    it('should generate reasoning', () => {
      const wakeTime = new Date('2024-01-01T08:00:00').getTime();
      
      const result = calculator.calculate({
        targetWakeTime: wakeTime,
        chronotype: 'intermediate',
      });
      
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes('cycle'))).toBe(true);
      expect(result.reasoning.some(r => r.includes('endormissement') || r.includes('Endormissement'))).toBe(true);
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const time = new Date('2024-01-01T07:30:00').getTime();
      const formatted = calculator.formatTime(time);
      
      expect(formatted).toMatch(/07:30|7:30/);
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(calculator.formatDuration(7.5 * 60 * 60 * 1000)).toBe('7h 30min');
      expect(calculator.formatDuration(45 * 60 * 1000)).toBe('0h 45min');
      expect(calculator.formatDuration(8 * 60 * 60 * 1000)).toBe('8h 0min');
    });
  });
});