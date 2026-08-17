import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { UserProfile, SleepSession, SleepTrend, AdaptiveLearningData, DEFAULT_USER_PROFILE, DB_SCHEMA } from './types';

const DB_NAME = 'smart_clock.db';
const CURRENT_USER_ID = 'current_user';

export class DatabaseService {
  private db: SQLiteDatabase;
  private static instance: DatabaseService;

  private constructor() {
    this.db = openDatabaseSync(DB_NAME);
    this.initSchema();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initSchema(): void {
    this.db.execSync(DB_SCHEMA);
  }

  // ===== USER PROFILE =====

  async getProfile(): Promise<UserProfile | null> {
    const result = this.db.getFirstSync<{ data: string }>(
      'SELECT data FROM user_profile WHERE id = ?',
      [CURRENT_USER_ID]
    );
    if (result) {
      return JSON.parse(result.data);
    }
    return null;
  }

  async getOrCreateProfile(): Promise<UserProfile> {
    let profile = await this.getProfile();
    if (!profile) {
      profile = await this.createDefaultProfile();
    }
    return profile;
  }

  async createDefaultProfile(): Promise<UserProfile> {
    const now = Date.now();
    const profile: UserProfile = {
      id: CURRENT_USER_ID,
      createdAt: now,
      updatedAt: now,
      ...DEFAULT_USER_PROFILE,
    };
    await this.saveProfile(profile);
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const now = Date.now();
    const updatedProfile = { ...profile, updatedAt: now };
    
    this.db.runSync(
      `INSERT OR REPLACE INTO user_profile (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [CURRENT_USER_ID, JSON.stringify(updatedProfile), profile.createdAt, now]
    );
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.getOrCreateProfile();
    const updated = { ...profile, ...updates };
    await this.saveProfile(updated);
    return updated;
  }

  // ===== SLEEP SESSIONS =====

  async saveSleepSession(session: SleepSession): Promise<void> {
    const now = Date.now();
    const sessionToSave = { ...session, updatedAt: now };
    
    this.db.runSync(
      `INSERT OR REPLACE INTO sleep_sessions (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [session.id, CURRENT_USER_ID, JSON.stringify(sessionToSave), session.createdAt, now]
    );
  }

  async getSleepSession(id: string): Promise<SleepSession | null> {
    const result = this.db.getFirstSync<{ data: string }>(
      'SELECT data FROM sleep_sessions WHERE id = ? AND user_id = ?',
      [id, CURRENT_USER_ID]
    );
    if (result) {
      return JSON.parse(result.data);
    }
    return null;
  }

  async getRecentSleepSessions(limit: number = 30): Promise<SleepSession[]> {
    const results = this.db.getAllSync<{ data: string }>(
      'SELECT data FROM sleep_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [CURRENT_USER_ID, limit]
    );
    return results.map(r => JSON.parse(r.data));
  }

  async getSleepSessionsInRange(startTime: number, endTime: number): Promise<SleepSession[]> {
    const results = this.db.getAllSync<{ data: string }>(
      'SELECT data FROM sleep_sessions WHERE user_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC',
      [CURRENT_USER_ID, startTime, endTime]
    );
    return results.map(r => JSON.parse(r.data));
  }

  async deleteSleepSession(id: string): Promise<void> {
    this.db.runSync(
      'DELETE FROM sleep_sessions WHERE id = ? AND user_id = ?',
      [id, CURRENT_USER_ID]
    );
  }

  async deleteOldSessions(olderThan: number): Promise<number> {
    const result = this.db.runSync(
      'DELETE FROM sleep_sessions WHERE user_id = ? AND created_at < ?',
      [CURRENT_USER_ID, olderThan]
    );
    return result.changes;
  }

  // ===== ADAPTIVE LEARNING =====

  async getAdaptiveLearning(): Promise<AdaptiveLearningData | null> {
    const result = this.db.getFirstSync<{ data: string }>(
      'SELECT data FROM adaptive_learning WHERE user_id = ?',
      [CURRENT_USER_ID]
    );
    if (result) {
      return JSON.parse(result.data);
    }
    return null;
  }

  async saveAdaptiveLearning(data: AdaptiveLearningData): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO adaptive_learning (user_id, data, updated_at) VALUES (?, ?, ?)`,
      [CURRENT_USER_ID, JSON.stringify(data), Date.now()]
    );
  }

  async updateAdaptiveLearning(updates: Partial<AdaptiveLearningData>): Promise<AdaptiveLearningData> {
    const current = await this.getAdaptiveLearning() || {
      rmsBaseline: DEFAULT_USER_PROFILE.learnedRmsBaseline,
      accelBaseline: DEFAULT_USER_PROFILE.learnedAccelBaseline,
      cycleLength: DEFAULT_USER_PROFILE.learnedCycleLength,
      fallAsleepDuration: DEFAULT_USER_PROFILE.learnedFallAsleep,
      lastUpdated: Date.now(),
      sampleCount: 0,
    };
    
    const updated = { ...current, ...updates, lastUpdated: Date.now() };
    await this.saveAdaptiveLearning(updated);
    return updated;
  }

  // ===== TRENDS & ANALYTICS =====

  async getSleepTrends(days: number = 30): Promise<SleepTrend[]> {
    const sessions = await this.getRecentSleepSessions(days);
    const trendsByDate = new Map<string, SleepSession[]>();
    
    for (const session of sessions) {
      if (!session.endTime) continue;
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!trendsByDate.has(date)) trendsByDate.set(date, []);
      trendsByDate.get(date)!.push(session);
    }

    const trends: SleepTrend[] = [];
    for (const [date, daySessions] of trendsByDate) {
      const validSessions = daySessions.filter(s => s.totalSleepTime && s.sleepEfficiency);
      if (validSessions.length === 0) continue;

      const avgSleepTime = validSessions.reduce((a, b) => a + (b.totalSleepTime || 0), 0) / validSessions.length;
      const avgEfficiency = validSessions.reduce((a, b) => a + (b.sleepEfficiency || 0), 0) / validSessions.length;
      const avgCycles = validSessions.reduce((a, b) => a + (b.cyclesCount || 0), 0) / validSessions.length;
      
      const qualityMap = { great: 4, good: 3, ok: 2, poor: 1 };
      const avgQuality = validSessions
        .filter(s => s.qualityRating)
        .reduce((a, b) => a + (qualityMap[b.qualityRating!] || 0), 0) / 
        Math.max(1, validSessions.filter(s => s.qualityRating).length);

      const bedtimes = daySessions.map(s => new Date(s.startTime).getHours() * 60 + new Date(s.startTime).getMinutes());
      const wakeTimes = daySessions.map(s => s.actualWakeTime ? new Date(s.actualWakeTime).getHours() * 60 + new Date(s.actualWakeTime).getMinutes() : 0).filter(t => t > 0);
      
      const bedtimeConsistency = this.calculateConsistency(bedtimes);
      const wakeTimeConsistency = this.calculateConsistency(wakeTimes);

      trends.push({
        date,
        avgSleepTime,
        avgEfficiency,
        avgQuality,
        avgCycles,
        bedtimeConsistency,
        wakeTimeConsistency,
      });
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateConsistency(times: number[]): number {
    if (times.length < 2) return 100;
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, 100 - (stdDev / 1440) * 100);
  }

  async getWeeklyStats(): Promise<{
    avgSleepTime: number;
    avgEfficiency: number;
    avgQuality: number;
    totalNights: number;
    bestNight: SleepSession | null;
    worstNight: SleepSession | null;
  }> {
    const sessions = await this.getRecentSleepSessions(7);
    const valid = sessions.filter(s => s.totalSleepTime && s.sleepEfficiency && s.qualityRating);
    
    if (valid.length === 0) {
      return { avgSleepTime: 0, avgEfficiency: 0, avgQuality: 0, totalNights: 0, bestNight: null, worstNight: null };
    }

    const qualityMap = { great: 4, good: 3, ok: 2, poor: 1 };
    
    return {
      avgSleepTime: valid.reduce((a, b) => a + (b.totalSleepTime || 0), 0) / valid.length,
      avgEfficiency: valid.reduce((a, b) => a + (b.sleepEfficiency || 0), 0) / valid.length,
      avgQuality: valid.reduce((a, b) => a + (qualityMap[b.qualityRating!] || 0), 0) / valid.length,
      totalNights: valid.length,
      bestNight: valid.reduce((best, s) => !best || (qualityMap[s.qualityRating!] || 0) > (qualityMap[best.qualityRating!] || 0) ? s : best, null as SleepSession | null),
      worstNight: valid.reduce((worst, s) => !worst || (qualityMap[s.qualityRating!] || 0) < (qualityMap[worst.qualityRating!] || 0) ? s : worst, null as SleepSession | null),
    };
  }

  // ===== APP SETTINGS =====

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const result = this.db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    if (result) {
      try {
        return JSON.parse(result.value);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, JSON.stringify(value), Date.now()]
    );
  }

  // ===== EXPORT / IMPORT =====

  async exportAllData(): Promise<string> {
    const profile = await this.getProfile();
    const sessions = await this.getRecentSleepSessions(10000);
    const learning = await this.getAdaptiveLearning();
    
    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      profile,
      sessions,
      adaptiveLearning: learning,
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importData(json: string): Promise<void> {
    const data = JSON.parse(json);
    
    if (data.profile) {
      await this.saveProfile(data.profile);
    }
    if (data.sessions) {
      for (const session of data.sessions) {
        await this.saveSleepSession(session);
      }
    }
    if (data.adaptiveLearning) {
      await this.saveAdaptiveLearning(data.adaptiveLearning);
    }
  }

  async clearAllData(): Promise<void> {
    this.db.runSync('DELETE FROM sleep_sessions WHERE user_id = ?', [CURRENT_USER_ID]);
    this.db.runSync('DELETE FROM adaptive_learning WHERE user_id = ?', [CURRENT_USER_ID]);
    this.db.runSync('DELETE FROM user_profile WHERE id = ?', [CURRENT_USER_ID]);
  }

  // ===== UTILITIES =====

  async vacuum(): Promise<void> {
    this.db.execSync('VACUUM');
  }

  async getDbSize(): Promise<number> {
    const result = this.db.getFirstSync<{ size: number }>(
      "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
    );
    return result?.size || 0;
  }
}

export function getDatabaseService(): DatabaseService {
  return DatabaseService.getInstance();
}