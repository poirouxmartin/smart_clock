import { DatabaseService, getDatabaseService } from '../DatabaseService';
import { UserProfileManager, getUserProfileManager } from '../UserProfileManager';
import { UserProfile, SleepSession, DEFAULT_USER_PROFILE } from '../types';

describe('DatabaseService', () => {
  let db: ReturnType<typeof getDatabaseService>;
  let manager: UserProfileManager;
  let seq = 0;

  // Persists a session through the DB layer. UserProfileManager normally fills id/userId/createdAt;
  // createdAt = startTime so that retention (deleteOldSessions) works on the session's own age.
  const saveSession = async (
    database: DatabaseService,
    s: Omit<SleepSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SleepSession> => {
    const full: SleepSession = { ...s, id: `test_session_${++seq}`, userId: 'current_user', createdAt: s.startTime, updatedAt: s.startTime };
    await database.saveSleepSession(full);
    return full;
  };

  beforeEach(async () => {
    db = getDatabaseService();
    manager = new UserProfileManager(db);
    // Clear database; the app always has a profile (adaptive_learning has a FK to user_profile)
    await db.clearAllData();
    await db.getOrCreateProfile();
    // App calls initialize() at startup; updateAdaptiveLearning is a no-op until profileCache is loaded
    await manager.initialize();
  });

  describe('User Profile', () => {
    it('should create default profile', async () => {
      const profile = await db.getOrCreateProfile();
      
      expect(profile).toBeDefined();
      expect(profile.id).toBe('current_user');
      expect(profile.chronotype).toBe('intermediate');
      expect(profile.sleepCycleLength).toBe(90 * 60 * 1000);
      expect(profile.onboardingComplete).toBe(false);
    });

    it('should save and retrieve profile', async () => {
      const updates: Partial<UserProfile> = {
        name: 'Test User',
        chronotype: 'morning',
        desiredCycles: 6,
      };
      
      const saved = await db.updateProfile(updates);
      
      expect(saved.name).toBe('Test User');
      expect(saved.chronotype).toBe('morning');
      expect(saved.desiredCycles).toBe(6);
      
      const retrieved = (await db.getProfile())!;
      expect(retrieved.name).toBe('Test User');
      expect(retrieved.chronotype).toBe('morning');
    });

    it('should update sleep preferences', async () => {
      await manager.updateSleepPreferences({
        chronotype: 'evening',
        desiredCycles: 6,
        fallAsleepDuration: 20 * 60 * 1000,
      });
      
      const profile = (await db.getProfile())!;
      expect(profile.chronotype).toBe('evening');
      expect(profile.desiredCycles).toBe(6);
      expect(profile.fallAsleepDuration).toBe(20 * 60 * 1000);
    });
  });

  describe('Sleep Sessions', () => {
    it('should save and retrieve sleep session', async () => {
      const session: Omit<SleepSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        startTime: Date.now() - 8 * 60 * 60 * 1000,
        endTime: Date.now(),
        targetWakeWindow: { start: Date.now() - 30 * 60 * 1000, end: Date.now() + 60 * 60 * 1000 },
        actualWakeTime: Date.now(),
        wakeTriggerReason: 'Light sleep detected',
        wakeConfidence: 0.85,
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
        qualityRating: 'good',
        moodRating: 4,
      };
      
      const saved = await saveSession(db, session);
      
      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe('current_user');
      expect(saved.qualityRating).toBe('good');
      
      const retrieved = await db.getSleepSession(saved.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.qualityRating).toBe('good');
    });

    it('should retrieve recent sessions', async () => {
      for (let i = 0; i < 3; i++) {
        await saveSession(db, {
          startTime: Date.now() - (i + 1) * 24 * 60 * 60 * 1000,
          endTime: Date.now() - i * 24 * 60 * 60 * 1000,
          targetWakeWindow: { start: 0, end: 0 },
          totalSleepTime: 7 * 60 * 60 * 1000,
          sleepEfficiency: 80 + i * 2,
          cyclesCount: 5,
          qualityRating: 'good',
        });
      }
      
      const sessions = await db.getRecentSleepSessions(10);
      expect(sessions.length).toBe(3);
      expect(sessions[0].startTime).toBeGreaterThan(sessions[1].startTime);
    });

    it('should rate sleep session', async () => {
      const saved = await saveSession(db, {
        startTime: Date.now() - 8 * 60 * 60 * 1000,
        endTime: Date.now(),
        targetWakeWindow: { start: 0, end: 0 },
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
      });
      
      await manager.rateSleepSession(saved.id, 'great', 5, 'Excellent sleep!');
      
      const updated = await db.getSleepSession(saved.id);
      expect(updated?.qualityRating).toBe('great');
      expect(updated?.moodRating).toBe(5);
      expect(updated?.notes).toBe('Excellent sleep!');
    });
  });

  describe('Adaptive Learning', () => {
    it('should update adaptive learning from epochs', async () => {
      const epochs = Array(100).fill(null).map((_, i) => ({
        timestamp: Date.now() + i * 30000,
        audio: { rms: 0.01 + Math.sin(i * 0.1) * 0.005, spectralCentroid: 300, spectralFlux: 0.01, zeroCrossingRate: 0.05, lowFreqEnergy: 10, highFreqEnergy: 5, timestamp: Date.now() + i * 30000 },
        accel: { magnitude: 0.1 + Math.sin(i * 0.2) * 0.02, variance: 0.01, timestamp: Date.now() + i * 30000 },
        lightSleepScore: 0.5,
        movementDetected: false,
        snoringDetected: false,
        regularBreathing: true,
      }));
      
      const learning = await manager.updateAdaptiveLearning(epochs);
      
      expect(learning.rmsBaseline).toBeGreaterThan(0);
      expect(learning.accelBaseline).toBeGreaterThan(0);
      expect(learning.sampleCount).toBeGreaterThan(0);
      
      const profile = (await db.getProfile())!;
      expect(profile.learnedRmsBaseline).toBeCloseTo(learning.rmsBaseline, 2);
    });
  });

  describe('Trends & Analytics', () => {
    it('should calculate sleep trends', async () => {
      for (let i = 0; i < 7; i++) {
        await saveSession(db, {
          startTime: Date.now() - (i + 1) * 24 * 60 * 60 * 1000,
          endTime: Date.now() - i * 24 * 60 * 60 * 1000,
          targetWakeWindow: { start: 0, end: 0 },
          totalSleepTime: (7 + i * 0.2) * 60 * 60 * 1000,
          sleepEfficiency: 80 + i,
          cyclesCount: 5,
          qualityRating: 'good',
        });
      }
      
      const trends = await db.getSleepTrends(7);
      expect(trends.length).toBe(7);
      expect(trends[0].avgSleepTime).toBeGreaterThan(0);
      expect(trends[0].avgEfficiency).toBeGreaterThan(0);
    });

    it('should calculate weekly stats', async () => {
      for (let i = 0; i < 3; i++) {
        await saveSession(db, {
          startTime: Date.now() - (i + 1) * 24 * 60 * 60 * 1000,
          endTime: Date.now() - i * 24 * 60 * 60 * 1000,
          targetWakeWindow: { start: 0, end: 0 },
          totalSleepTime: 7.5 * 60 * 60 * 1000,
          sleepEfficiency: 85,
          cyclesCount: 5,
          qualityRating: 'good',
        });
      }
      
      const stats = await db.getWeeklyStats();
      expect(stats.totalNights).toBe(3);
      expect(stats.avgSleepTime).toBeCloseTo(7.5 * 60 * 60 * 1000);
      expect(stats.avgEfficiency).toBe(85);
      expect(stats.bestNight).toBeDefined();
      expect(stats.worstNight).toBeDefined();
    });
  });

  describe('Export/Import', () => {
    it('should export all data', async () => {
      await db.updateProfile({ name: 'Test User', chronotype: 'morning' });
      await saveSession(db, {
        startTime: Date.now() - 8 * 60 * 60 * 1000,
        endTime: Date.now(),
        targetWakeWindow: { start: 0, end: 0 },
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
        qualityRating: 'good',
      });
      
      const json = await db.exportAllData();
      const data = JSON.parse(json);
      
      expect(data.version).toBe(1);
      expect(data.profile.name).toBe('Test User');
      expect(data.sessions.length).toBe(1);
      expect(data.adaptiveLearning).toBeDefined();
    });

    it('should import data', async () => {
      const exportData = {
        version: 1,
        exportedAt: Date.now(),
        profile: { ...DEFAULT_USER_PROFILE, id: 'current_user', createdAt: Date.now(), updatedAt: Date.now(), name: 'Imported User', chronotype: 'evening' },
        sessions: [{
          id: 'imported_session',
          userId: 'current_user',
          startTime: Date.now() - 8 * 60 * 60 * 1000,
          endTime: Date.now(),
          targetWakeWindow: { start: 0, end: 0 },
          totalSleepTime: 8 * 60 * 60 * 1000,
          sleepEfficiency: 90,
          cyclesCount: 5,
          qualityRating: 'great',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
        adaptiveLearning: { rmsBaseline: 0.02, accelBaseline: 0.15, cycleLength: 90 * 60 * 1000, fallAsleepDuration: 15 * 60 * 1000, lastUpdated: Date.now(), sampleCount: 100 },
      };
      
      await db.importData(JSON.stringify(exportData));
      
      const profile = (await db.getProfile())!;
      expect(profile.name).toBe('Imported User');
      expect(profile.chronotype).toBe('evening');
      
      const sessions = await db.getRecentSleepSessions(10);
      expect(sessions.length).toBe(1);
      expect(sessions[0].qualityRating).toBe('great');
    });
  });

  describe('Cleanup', () => {
    it('should delete old sessions', async () => {
      await saveSession(db, {
        startTime: Date.now() - 400 * 24 * 60 * 60 * 1000, // Old session
        endTime: Date.now() - 399 * 24 * 60 * 60 * 1000,
        targetWakeWindow: { start: 0, end: 0 },
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
        qualityRating: 'good',
      });
      
      await saveSession(db, {
        startTime: Date.now() - 10 * 24 * 60 * 60 * 1000, // Recent session
        endTime: Date.now() - 9 * 24 * 60 * 60 * 1000,
        targetWakeWindow: { start: 0, end: 0 },
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
        qualityRating: 'good',
      });
      
      const deleted = await db.deleteOldSessions(Date.now() - 365 * 24 * 60 * 60 * 1000);
      expect(deleted).toBe(1);
      
      const sessions = await db.getRecentSleepSessions(10);
      expect(sessions.length).toBe(1);
    });

    it('should clear all data', async () => {
      await db.updateProfile({ name: 'Test' });
      await saveSession(db, {
        startTime: Date.now() - 8 * 60 * 60 * 1000,
        endTime: Date.now(),
        targetWakeWindow: { start: 0, end: 0 },
        totalSleepTime: 7.5 * 60 * 60 * 1000,
        sleepEfficiency: 85,
        cyclesCount: 5,
        qualityRating: 'good',
      });
      
      await db.clearAllData();
      
      expect(await db.getProfile()).toBeNull();
      
      const sessions = await db.getRecentSleepSessions(10);
      expect(sessions.length).toBe(0);
    });
  });
});

describe('UserProfileManager', () => {
  let manager: ReturnType<typeof getUserProfileManager>;

  beforeEach(() => {
    manager = getUserProfileManager();
    // Clear database
    const db = getDatabaseService();
    db.clearAllData();
  });

  it('should initialize and cache profile', async () => {
    const profile = await manager.initialize();
    
    expect(profile).toBeDefined();
    expect(manager.getProfile()).toBe(profile);
  });

  it('should update profile and notify listeners', async () => {
    await manager.initialize();
    
    let notified = false;
    const unsubscribe = manager.onProfileChange(() => { notified = true; });
    
    await manager.updateProfile({ name: 'Test User' });
    
    expect(notified).toBe(true);
    expect(manager.getProfile()?.name).toBe('Test User');
    
    unsubscribe();
  });

  it('should save sleep session', async () => {
    await manager.initialize();
    
    const session = await manager.saveSleepSession({
      startTime: Date.now() - 8 * 60 * 60 * 1000,
      endTime: Date.now(),
      targetWakeWindow: { start: Date.now() - 30 * 60 * 1000, end: Date.now() + 60 * 60 * 1000 },
      actualWakeTime: Date.now(),
      wakeTriggerReason: 'Light sleep detected',
      wakeConfidence: 0.9,
      totalSleepTime: 7.5 * 60 * 60 * 1000,
      sleepEfficiency: 88,
      cyclesCount: 5,
      qualityRating: 'great',
      moodRating: 5,
    });
    
    expect(session.id).toBeDefined();
    expect(session.qualityRating).toBe('great');
  });

  it('should rate sleep session', async () => {
    await manager.initialize();
    
    const session = await manager.saveSleepSession({
      startTime: Date.now() - 8 * 60 * 60 * 1000,
      endTime: Date.now(),
      targetWakeWindow: { start: 0, end: 0 },
      totalSleepTime: 7.5 * 60 * 60 * 1000,
      sleepEfficiency: 85,
      cyclesCount: 5,
    });
    
    await manager.rateSleepSession(session.id, 'poor', 2, 'Bad night');
    
    const sessions = await manager.getRecentSessions(10);
    expect(sessions[0].qualityRating).toBe('poor');
    expect(sessions[0].moodRating).toBe(2);
    expect(sessions[0].notes).toBe('Bad night');
  });

  it('should export and import data', async () => {
    await manager.initialize();
    await manager.updateProfile({ name: 'Export Test' });
    
    const json = await manager.exportData();
    expect(json).toContain('Export Test');
    
    await manager.clearAllData();
    await manager.importData(json);
    
    const profile = manager.getProfile();
    expect(profile?.name).toBe('Export Test');
  });
});