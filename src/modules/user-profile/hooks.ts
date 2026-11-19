import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfileManager, getUserProfileManager } from './UserProfileManager';
import { UserProfile, SleepSession, SleepTrend, AdaptiveLearningData } from './types';

export function useUserProfile() {
  const [manager] = useState(() => getUserProfileManager());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        const p = await manager.initialize();
        if (mounted) {
          setProfile(p);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Erreur initialisation');
          setLoading(false);
        }
      }
    };
    
    init();
    
    const unsubscribe = manager.onProfileChange((p) => {
      if (mounted) setProfile(p);
    });
    
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [manager]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const updated = await manager.updateProfile(updates);
      setProfile(updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur mise à jour');
      throw e;
    }
  }, [manager]);

  const updateSleepPrefs = useCallback(async (prefs: Parameters<UserProfileManager['updateSleepPreferences']>[0]) => {
    return manager.updateSleepPreferences(prefs);
  }, [manager]);

  const updateAlarmPrefs = useCallback(async (prefs: Parameters<UserProfileManager['updateAlarmPreferences']>[0]) => {
    return manager.updateAlarmPreferences(prefs);
  }, [manager]);

  const updateLightPrefs = useCallback(async (prefs: Parameters<UserProfileManager['updateLightPreferences']>[0]) => {
    return manager.updateLightPreferences(prefs);
  }, [manager]);

  const updateNotificationPrefs = useCallback(async (prefs: Parameters<UserProfileManager['updateNotificationPreferences']>[0]) => {
    return manager.updateNotificationPreferences(prefs);
  }, [manager]);

  const updatePrivacy = useCallback(async (settings: Parameters<UserProfileManager['updatePrivacySettings']>[0]) => {
    return manager.updatePrivacySettings(settings);
  }, [manager]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    updateSleepPrefs,
    updateAlarmPrefs,
    updateLightPrefs,
    updateNotificationPrefs,
    updatePrivacy,
    manager,
  };
}

export function useSleepSessions(limit: number = 30) {
  const { manager } = useUserProfile();
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const data = await manager.getRecentSessions(limit);
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }, [manager, limit]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const saveSession = useCallback(async (session: Omit<SleepSession, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const saved = await manager.saveSleepSession(session);
    setSessions(prev => [saved, ...prev.slice(0, limit - 1)]);
    return saved;
  }, [manager, limit]);

  const updateSession = useCallback(async (id: string, updates: Partial<SleepSession>) => {
    const updated = await manager.updateSleepSession(id, updates);
    if (updated) {
      setSessions(prev => prev.map(s => s.id === id ? updated : s));
    }
    return updated;
  }, [manager]);

  const rateSession = useCallback(async (id: string, rating: SleepSession['qualityRating'], mood?: SleepSession['moodRating'], notes?: string) => {
    await manager.rateSleepSession(id, rating, mood, notes);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, qualityRating: rating, moodRating: mood, notes } : s));
  }, [manager]);

  const deleteSession = useCallback(async (id: string) => {
    await manager.getSession(id); // Checks existence
    // Note: DatabaseService doesn't expose delete, would need to add
  }, [manager]);

  return {
    sessions,
    loading,
    saveSession,
    updateSession,
    rateSession,
    refresh: loadSessions,
  };
}

export function useSleepTrends(days: number = 30) {
  const { manager } = useUserProfile();
  const [trends, setTrends] = useState<SleepTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const load = async () => {
      try {
        const data = await manager.getTrends(days);
        if (mounted) {
          setTrends(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };
    
    load();
    
    return () => { mounted = false; };
  }, [manager, days]);

  const weeklyStats = useMemo(() => {
    if (trends.length === 0) return null;
    const last7 = trends.slice(-7);
    return {
      avgSleepTime: last7.reduce((a, b) => a + b.avgSleepTime, 0) / last7.length,
      avgEfficiency: last7.reduce((a, b) => a + b.avgEfficiency, 0) / last7.length,
      avgQuality: last7.reduce((a, b) => a + b.avgQuality, 0) / last7.length,
      bedtimeConsistency: last7.reduce((a, b) => a + b.bedtimeConsistency, 0) / last7.length,
      wakeTimeConsistency: last7.reduce((a, b) => a + b.wakeTimeConsistency, 0) / last7.length,
    };
  }, [trends]);

  return { trends, weeklyStats, loading };
}

export function useAdaptiveLearning() {
  const { manager, profile } = useUserProfile();
  const [learning, setLearning] = useState<AdaptiveLearningData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const load = async () => {
      try {
        const data = await manager.getAdaptiveLearning();
        if (mounted) {
          setLearning(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };
    
    load();
  }, [manager]);

  const updateFromEpochs = useCallback(async (epochs: any[]) => {
    const updated = await manager.updateAdaptiveLearning(epochs);
    setLearning(updated);
    return updated;
  }, [manager]);

  const baselines = useMemo(() => ({
    rms: profile?.learnedRmsBaseline || 0.01,
    accel: profile?.learnedAccelBaseline || 0.1,
  }), [profile]);

  return { learning, baselines, loading, updateFromEpochs };
}

export function useExportImport() {
  const { manager } = useUserProfile();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportData = useCallback(async (): Promise<string> => {
    setExporting(true);
    try {
      return await manager.exportData();
    } finally {
      setExporting(false);
    }
  }, [manager]);

  const importData = useCallback(async (json: string): Promise<void> => {
    setImporting(true);
    try {
      await manager.importData(json);
    } finally {
      setImporting(false);
    }
  }, [manager]);

  const clearAll = useCallback(async () => {
    await manager.clearAllData();
  }, [manager]);

  return { exportData, importData, clearAll, exporting, importing };
}