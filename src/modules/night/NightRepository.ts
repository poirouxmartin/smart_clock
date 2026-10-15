import { SmartAlarm } from '../../../modules/smart-alarm';
import { getDatabaseService } from '../user-profile/DatabaseService';
import { analyzeNight, NightRecord, NightSummary } from './nightAnalysis';

const LIST_LIMIT = 30;

export const NightRepository = {
  /** Importe en base les nuits terminées côté natif et renvoie les résumés (plus récent d'abord). */
  async syncNights(): Promise<NightSummary[]> {
    const db = getDatabaseService();
    const ids = await SmartAlarm.listNights();
    for (const id of ids) {
      try {
        const existing = await db.getNightSummary(id);
        if (existing) continue;
        const raw = await SmartAlarm.readNight(id);
        if (!raw) continue;
        const record = JSON.parse(raw) as NightRecord;
        if (!record.endedAtMs || record.endedAtMs <= 0) continue;
        await db.saveNightSummary(analyzeNight({ ...record, sessionId: record.sessionId || id }));
      } catch (e) {
        console.error('NightRepository.syncNights error for', id, e);
      }
    }
    return db.getNightSummaries(LIST_LIMIT);
  },

  async getLatest(): Promise<NightSummary | null> {
    const list = await getDatabaseService().getNightSummaries(1);
    return list[0] ?? null;
  },

  /** Résumé depuis la base, sinon analyse directe du fichier natif. */
  async loadNightSummary(sessionId: string): Promise<NightSummary | null> {
    const db = getDatabaseService();
    const stored = await db.getNightSummary(sessionId);
    if (stored) return stored;
    const raw = await SmartAlarm.readNight(sessionId);
    if (!raw) return null;
    const record = JSON.parse(raw) as NightRecord;
    return analyzeNight({ ...record, sessionId: record.sessionId || sessionId });
  },
};
