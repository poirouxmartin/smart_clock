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

  /** Analyse fraîche du fichier natif (heures, cible, fenêtre), sinon résumé stocké en base. */
  async loadNightSummary(sessionId: string): Promise<NightSummary | null> {
    try {
      const raw = await SmartAlarm.readNight(sessionId);
      if (raw) {
        const record = JSON.parse(raw) as NightRecord;
        return analyzeNight({ ...record, sessionId: record.sessionId || sessionId });
      }
    } catch (e) {
      console.error('NightRepository.loadNightSummary error for', sessionId, e);
    }
    return getDatabaseService().getNightSummary(sessionId);
  },

  /** Supprime la nuit partout : fichier natif (sinon elle serait réimportée) et résumé en base. */
  async deleteNight(sessionId: string): Promise<void> {
    await SmartAlarm.deleteNight(sessionId);
    await getDatabaseService().deleteNightSummary(sessionId);
  },
};
