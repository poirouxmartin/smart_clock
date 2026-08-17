import { DatabaseService, getDatabaseService } from './DatabaseService';
import { UserProfile, SleepSession, SleepTrend, AdaptiveLearningData, DEFAULT_USER_PROFILE } from './types';
import { SleepEpochFeatures } from '@/modules/sleep-analysis';

export class UserProfileManager {
  private db: DatabaseService;
  private profileCache: UserProfile | null = null;
  private listeners: Set<(profile: UserProfile) => void> = new Set();

  constructor(db?: DatabaseService) {
    this.db = db || getDatabaseService();
  }

  async initialize(): Promise<UserProfile> {
    this.profileCache = await this.db.getOrCreateProfile();
    return this.profileCache;
  }

  getProfile(): UserProfile | null {
    return this.profileCache;
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.profileCache) await this.initialize();
    const updated = await this.db.updateProfile(updates);
    this.profileCache = updated;
    this.notifyListeners(updated);
    return updated;
  }

  async updateSleepPreferences(prefs: {
    chronotype?: UserProfile['chronotype'];
    sleepCycleLength?: number;
    fallAsleepDuration?: number;
    desiredCycles?: number;
    typicalBedtime?: string;
    typicalWakeTime?: string;
  }): Promise<UserProfile> {
    return this.updateProfile(prefs);
  }

  async updateAlarmPreferences(prefs: {
    preferredSounds?: string[];
    defaultVolume?: number;
    defaultFadeInDuration?: number;
    vibrationEnabled?: boolean;
    snoozeEnabled?: boolean;
    snoozeDuration?: number;
  }): Promise<UserProfile> {
    return this.updateProfile(prefs);
  }

  async updateLightPreferences(prefs: {
    lightEnabled?: boolean;
    lightDeviceIds?: string[];
    wakeUpLightConfig?: UserProfile['wakeUpLightConfig'];
  }): Promise<UserProfile> {
    return this.updateProfile(prefs);
  }

  async updateNotificationPreferences(prefs: {
    bedtimeReminderEnabled?: boolean;
    bedtimeReminderMinutes?: number;
    windDownEnabled?: boolean;
    windDownMinutes?: number;
  }): Promise<UserProfile> {
    return this.updateProfile(prefs);
  }

  async updatePrivacySettings(settings: {
    dataRetentionDays?: number;
    analyticsEnabled?: boolean;
    crashReportingEnabled?: boolean;
  }): Promise<UserProfile> {
    return this.updateProfile(settings);
  }

  async saveSleepSession(session: Omit<SleepSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<SleepSession> {
    const fullSession: SleepSession = {
      ...session,
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'current_user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.db.saveSleepSession(fullSession);
    return fullSession;
  }

  async updateSleepSession(id: string, updates: Partial<SleepSession>): Promise<SleepSession | null> {
    const session = await this.db.getSleepSession(id);
    if (!session) return null;
    
    const updated = { ...session, ...updates, updatedAt: Date.now() };
    await this.db.saveSleepSession(updated);
    return updated;
  }

  async rateSleepSession(id: string, rating: SleepSession['qualityRating'], mood?: SleepSession['moodRating'], notes?: string): Promise<void> {
    await this.updateSleepSession(id, { qualityRating: rating, moodRating: mood, notes });
  }

  async getRecentSessions(limit: number = 30): Promise<SleepSession[]> {
    return this.db.getRecentSleepSessions(limit);
  }

  async getSession(id: string): Promise<SleepSession | null> {
    return this.db.getSleepSession(id);
  }

  async getTrends(days: number = 30): Promise<SleepTrend[]> {
    return this.db.getSleepTrends(days);
  }

  async getWeeklyStats(): Promise<{
    avgSleepTime: number;
    avgEfficiency: number;
    avgQuality: number;
    totalNights: number;
    bestNight: SleepSession | null;
    worstNight: SleepSession | null;
  }> {
    return this.db.getWeeklyStats();
  }

  async updateAdaptiveLearning(epochs: SleepEpochFeatures[]): Promise<AdaptiveLearningData> {
    if (!this.profileCache || !this.profileCache.adaptiveLearningEnabled) {
      return this.getAdaptiveLearning();
    }

    const rmsValues = epochs.map(e => e.audio.rms).filter(v => v > 0);
    const accelValues = epochs.map(e => e.accel.magnitude).filter(v => v > 0);
    const lightSleepEpochs = epochs.filter(e => e.lightSleepScore > 0.6);
    
    let newRmsBaseline = this.profileCache.learnedRmsBaseline;
    let newAccelBaseline = this.profileCache.learnedAccelBaseline;
    
    if (rmsValues.length > 10) {
      const sorted = [...rmsValues].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      newRmsBaseline = this.profileCache.learnedRmsBaseline * 0.9 + median * 0.1;
    }
    
    if (accelValues.length > 10) {
      const sorted = [...accelValues].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      newAccelBaseline = this.profileCache.learnedAccelBaseline * 0.9 + median * 0.1;
    }

    const learning = await this.db.updateAdaptiveLearning({
      rmsBaseline: newRmsBaseline,
      accelBaseline: newAccelBaseline,
      sampleCount: (await this.db.getAdaptiveLearning())?.sampleCount || 0 + epochs.length,
    });

    await this.updateProfile({
      learnedRmsBaseline: newRmsBaseline,
      learnedAccelBaseline: newAccelBaseline,
    });

    return learning;
  }

  async getAdaptiveLearning(): Promise<AdaptiveLearningData> {
    const learning = await this.db.getAdaptiveLearning();
    if (learning) return learning;
    
    return {
      rmsBaseline: this.profileCache?.learnedRmsBaseline || DEFAULT_USER_PROFILE.learnedRmsBaseline,
      accelBaseline: this.profileCache?.learnedAccelBaseline || DEFAULT_USER_PROFILE.learnedAccelBaseline,
      cycleLength: this.profileCache?.learnedCycleLength || DEFAULT_USER_PROFILE.learnedCycleLength,
      fallAsleepDuration: this.profileCache?.learnedFallAsleep || DEFAULT_USER_PROFILE.learnedFallAsleep,
      lastUpdated: Date.now(),
      sampleCount: 0,
    };
  }

  getLearnedBaselines(): { rms: number; accel: number } {
    return {
      rms: this.profileCache?.learnedRmsBaseline || DEFAULT_USER_PROFILE.learnedRmsBaseline,
      accel: this.profileCache?.learnedAccelBaseline || DEFAULT_USER_PROFILE.learnedAccelBaseline,
    };
  }

  async cleanupOldData(): Promise<number> {
    if (!this.profileCache) return 0;
    const cutoff = Date.now() - this.profileCache.dataRetentionDays * 24 * 60 * 60 * 1000;
    return this.db.deleteOldSessions(cutoff);
  }

  async exportData(): Promise<string> {
    return this.db.exportAllData();
  }

  async importData(json: string): Promise<void> {
    await this.db.importData(json);
    this.profileCache = await this.db.getProfile();
    this.notifyListeners(this.profileCache!);
  }

  async clearAllData(): Promise<void> {
    await this.db.clearAllData();
    this.profileCache = await this.db.createDefaultProfile();
    this.notifyListeners(this.profileCache);
  }

  onProfileChange(callback: (profile: UserProfile) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(profile: UserProfile): void {
    this.listeners.forEach(cb => cb(profile));
  }
}

let userProfileManagerInstance: UserProfileManager | null = null;

export function getUserProfileManager(): UserProfileManager {
  if (!userProfileManagerInstance) {
    userProfileManagerInstance = new UserProfileManager();
  }
  return userProfileManagerInstance;
}

export function createUserProfileManager(db?: DatabaseService): UserProfileManager {
  return new UserProfileManager(db);
}