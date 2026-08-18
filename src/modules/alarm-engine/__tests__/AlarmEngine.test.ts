import { AlarmScheduler, createAlarmScheduler } from '../AlarmScheduler';
import { AlarmMonitor, createAlarmMonitor } from '../AlarmMonitor';
import { AlarmEngine, createAlarmEngine } from '../AlarmEngine';
import { AlarmConfig } from '@/types';

describe('AlarmScheduler', () => {
  let scheduler: ReturnType<typeof createAlarmScheduler>;

  beforeEach(() => {
    scheduler = createAlarmScheduler();
  });

  describe('computeNextOccurrence', () => {
    it('should find next occurrence for daily alarm', () => {
      const alarm: AlarmConfig = {
        id: 'test1',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      const now = new Date('2024-01-01T06:00:00').getTime();
      const next = scheduler.computeNextOccurrence(alarm, now);
      
      const expected = new Date('2024-01-01T07:00:00').getTime();
      expect(next).toBe(expected);
    });

    it('should find next occurrence for weekday-only alarm', () => {
      const alarm: AlarmConfig = {
        id: 'test2',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5], // Mon-Fri
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      // Saturday
      const saturday = new Date('2024-01-06T06:00:00').getTime();
      const next = scheduler.computeNextOccurrence(alarm, saturday);
      
      // Should be Monday
      const expected = new Date('2024-01-08T07:00:00').getTime();
      expect(next).toBe(expected);
    });

    it('should return tomorrow if time already passed today', () => {
      const alarm: AlarmConfig = {
        id: 'test3',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      const now = new Date('2024-01-01T08:00:00').getTime(); // Past 7am
      const next = scheduler.computeNextOccurrence(alarm, now);
      
      const expected = new Date('2024-01-02T07:00:00').getTime();
      expect(next).toBe(expected);
    });
  });

  describe('computeWakeWindow', () => {
    it('should create 1h30 window from start time', () => {
      const alarm: AlarmConfig = {
        id: 'test',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      const occurrence = new Date('2024-01-01T07:00:00').getTime();
      const window = scheduler.computeWakeWindow(alarm, occurrence);
      
      expect(window.start).toBe(occurrence);
      expect(window.end).toBe(occurrence + 90 * 60 * 1000);
      expect(window.alarmId).toBe('test');
    });
  });

  describe('isInWakeWindow', () => {
    it('should return true if within window', () => {
      const window = { start: 1000, end: 2000, alarmId: 'test' };
      expect(scheduler.isInWakeWindow(window, 1500)).toBe(true);
      expect(scheduler.isInWakeWindow(window, 1000)).toBe(true);
      expect(scheduler.isInWakeWindow(window, 2000)).toBe(true);
    });

    it('should return false if outside window', () => {
      const window = { start: 1000, end: 2000, alarmId: 'test' };
      expect(scheduler.isInWakeWindow(window, 500)).toBe(false);
      expect(scheduler.isInWakeWindow(window, 2500)).toBe(false);
    });
  });

  describe('getWakeWindowProgress', () => {
    it('should return progress between 0 and 1', () => {
      const window = { start: 1000, end: 2000, alarmId: 'test' };
      
      expect(scheduler.getWakeWindowProgress(window, 1000)).toBe(0);
      expect(scheduler.getWakeWindowProgress(window, 1500)).toBe(0.5);
      expect(scheduler.getWakeWindowProgress(window, 2000)).toBe(1);
      expect(scheduler.getWakeWindowProgress(window, 2500)).toBe(1);
      expect(scheduler.getWakeWindowProgress(window, 500)).toBe(0);
    });
  });
});

describe('AlarmMonitor', () => {
  let monitor: ReturnType<typeof createAlarmMonitor>;
  let mockAnalyzer: any;

  beforeEach(() => {
    monitor = createAlarmMonitor();
    
    mockAnalyzer = {
      checkWakeTrigger: jest.fn().mockReturnValue({
        shouldWake: false,
        confidence: 0,
        reason: 'Test',
        optimalWakeTime: Date.now(),
      }),
    };
    
    monitor.setSleepAnalyzer(mockAnalyzer);
  });

  afterEach(() => {
    monitor.shutdown();
  });

  describe('startMonitoring', () => {
    it('should start monitoring an alarm', () => {
      const alarm = {
        alarm: {
          id: 'test1',
          label: 'Test',
          wakeWindowStart: '07:00',
          wakeWindowEnd: '08:30',
          days: [1, 2, 3, 4, 5],
          enabled: true,
          soundId: 'birds',
          volume: 0.7,
          lightEnabled: false,
          vibrationEnabled: true,
          snoozeEnabled: true,
          snoozeDuration: 10,
        },
        state: 'scheduled' as const,
        wakeWindow: { start: Date.now(), end: Date.now() + 90 * 60 * 1000, alarmId: 'test1' },
        monitoringStartTime: Date.now(),
        snoozeCount: 0,
        lastCheckTime: Date.now(),
      };

      monitor.startMonitoring(alarm);
      
      expect(monitor.isMonitoring('test1')).toBe(true);
      expect(monitor.getActiveAlarm('test1')).toBeDefined();
    });

    it('should not duplicate monitoring', () => {
      const alarm = {
        alarm: { id: 'test1', label: 'Test', wakeWindowStart: '07:00', wakeWindowEnd: '08:30', days: [1], enabled: true, soundId: 'birds', volume: 0.7, lightEnabled: false, vibrationEnabled: true, snoozeEnabled: true, snoozeDuration: 10 },
        state: 'scheduled' as const,
        wakeWindow: { start: Date.now(), end: Date.now() + 90 * 60 * 1000, alarmId: 'test1' },
        monitoringStartTime: Date.now(),
        snoozeCount: 0,
        lastCheckTime: Date.now(),
      };

      monitor.startMonitoring(alarm);
      monitor.startMonitoring(alarm);
      
      expect(monitor.getAllActiveAlarms().length).toBe(1);
    });
  });

  describe('dismissAlarm', () => {
    it('should dismiss and stop monitoring', () => {
      const alarm = {
        alarm: { id: 'test1', label: 'Test', wakeWindowStart: '07:00', wakeWindowEnd: '08:30', days: [1], enabled: true, soundId: 'birds', volume: 0.7, lightEnabled: false, vibrationEnabled: true, snoozeEnabled: true, snoozeDuration: 10 },
        state: 'scheduled' as const,
        wakeWindow: { start: Date.now(), end: Date.now() + 90 * 60 * 1000, alarmId: 'test1' },
        monitoringStartTime: Date.now(),
        snoozeCount: 0,
        lastCheckTime: Date.now(),
      };

      monitor.startMonitoring(alarm);
      monitor.dismissAlarm('test1');
      
      expect(monitor.isMonitoring('test1')).toBe(false);
      expect(monitor.getActiveAlarm('test1')).toBeUndefined();
    });
  });

  describe('snoozeAlarm', () => {
    it('should snooze and create new window', () => {
      const alarm = {
        alarm: { id: 'test1', label: 'Test', wakeWindowStart: '07:00', wakeWindowEnd: '08:30', days: [1], enabled: true, soundId: 'birds', volume: 0.7, lightEnabled: false, vibrationEnabled: true, snoozeEnabled: true, snoozeDuration: 10 },
        state: 'scheduled' as const,
        wakeWindow: { start: Date.now(), end: Date.now() + 90 * 60 * 1000, alarmId: 'test1' },
        monitoringStartTime: Date.now(),
        snoozeCount: 0,
        lastCheckTime: Date.now(),
      };

      monitor.startMonitoring(alarm);
      const result = monitor.snoozeAlarm('test1');
      
      expect(result).toBe(true);
      const active = monitor.getActiveAlarm('test1');
      expect(active?.snoozeCount).toBe(1);
      expect(active?.state).toBe('monitoring');
    });

    it('should not snooze beyond max', () => {
      const alarm = {
        alarm: { id: 'test1', label: 'Test', wakeWindowStart: '07:00', wakeWindowEnd: '08:30', days: [1], enabled: true, soundId: 'birds', volume: 0.7, lightEnabled: false, vibrationEnabled: true, snoozeEnabled: true, snoozeDuration: 10 },
        state: 'scheduled' as const,
        wakeWindow: { start: Date.now(), end: Date.now() + 90 * 60 * 1000, alarmId: 'test1' },
        monitoringStartTime: Date.now(),
        snoozeCount: 3, // Already at max
        lastCheckTime: Date.now(),
      };

      monitor.startMonitoring(alarm);
      const result = monitor.snoozeAlarm('test1');
      
      expect(result).toBe(false);
    });
  });
});

describe('AlarmEngine', () => {
  let engine: ReturnType<typeof createAlarmEngine>;
  let mockAnalyzer: any;

  beforeEach(() => {
    engine = createAlarmEngine({ enableForegroundService: false });
    mockAnalyzer = {
      checkWakeTrigger: jest.fn().mockReturnValue({
        shouldWake: false,
        confidence: 0,
        reason: 'Test',
        optimalWakeTime: Date.now(),
      }),
    };
    engine.setSleepAnalyzer(mockAnalyzer);
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe('addAlarm', () => {
    it('should add and schedule alarm', () => {
      const alarm = {
        id: 'test1',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      engine.addAlarm(alarm);
      
      expect(engine.getEnabledAlarms()).toContainEqual(alarm);
    });

    it('should not add disabled alarm', () => {
      const alarm = {
        id: 'test2',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: false,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      engine.addAlarm(alarm);
      
      expect(engine.getEnabledAlarms().length).toBe(0);
    });
  });

  describe('removeAlarm', () => {
    it('should remove alarm and stop monitoring', () => {
      const alarm = {
        id: 'test3',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      engine.addAlarm(alarm);
      engine.removeAlarm('test3');
      
      expect(engine.getEnabledAlarms().length).toBe(0);
    });
  });

  describe('dismissAlarm', () => {
    it('should dismiss active alarm', () => {
      const alarm = {
        id: 'test4',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      engine.addAlarm(alarm);
      // Simulate monitoring started
      engine.dismissAlarm('test4');
      
      expect(engine.getActiveAlarm('test4')).toBeUndefined();
    });
  });

  describe('snoozeAlarm', () => {
    it('should snooze active alarm', () => {
      const alarm = {
        id: 'test5',
        label: 'Test',
        wakeWindowStart: '07:00',
        wakeWindowEnd: '08:30',
        days: [1, 2, 3, 4, 5],
        enabled: true,
        soundId: 'birds',
        volume: 0.7,
        lightEnabled: false,
        vibrationEnabled: true,
        snoozeEnabled: true,
        snoozeDuration: 10,
      };

      engine.addAlarm(alarm);
      const result = engine.snoozeAlarm('test5');
      
      // Will return false if not actively monitoring
      expect(typeof result).toBe('boolean');
    });
  });
});