import {
  BedtimeCalculationInput,
  BedtimeResult,
  AlternativeBedtime,
  SleepSchedule,
  DEFAULT_SLEEP_CYCLE_LENGTH,
  DEFAULT_FALL_ASLEEP_DURATION,
  DEFAULT_DESIRED_CYCLES,
  MIN_CYCLES,
  MAX_CYCLES,
  CHRONOTYPE_ADJUSTMENTS,
} from './types';

export class BedtimeCalculator {
  calculate(input: BedtimeCalculationInput): BedtimeResult {
    const {
      targetWakeTime,
      sleepCycleLength = DEFAULT_SLEEP_CYCLE_LENGTH,
      desiredCycles = DEFAULT_DESIRED_CYCLES,
      fallAsleepDuration = DEFAULT_FALL_ASLEEP_DURATION,
      chronotype = 'intermediate',
      bedtimeWindowStart,
      bedtimeWindowEnd,
    } = input;

    const adjustedCycleLength = sleepCycleLength + CHRONOTYPE_ADJUSTMENTS[chronotype].cycleLength;
    const adjustedFallAsleep = fallAsleepDuration + CHRONOTYPE_ADJUSTMENTS[chronotype].fallAsleep;
    const clampedCycles = Math.max(MIN_CYCLES, Math.min(MAX_CYCLES, desiredCycles));

    const totalSleepCyclesTime = clampedCycles * adjustedCycleLength;
    const totalSleepTime = totalSleepCyclesTime + adjustedFallAsleep;
    const idealBedtime = targetWakeTime - totalSleepTime;
    const fallAsleepEnd = idealBedtime + adjustedFallAsleep;

    const windowStart = bedtimeWindowStart || idealBedtime - 30 * 60 * 1000;
    const windowEnd = bedtimeWindowEnd || idealBedtime + 30 * 60 * 1000;

    const wakeUpAtEndOfCycle = this.isWakeAtCycleBoundary(targetWakeTime, fallAsleepEnd, adjustedCycleLength);
    const confidence = this.calculateConfidence(input, wakeUpAtEndOfCycle);
    const reasoning = this.generateReasoning(input, wakeUpAtEndOfCycle, confidence);
    const alternativeBedtimes = this.generateAlternatives(input, adjustedCycleLength, adjustedFallAsleep);

    return {
      idealBedtime,
      bedtimeWindow: { start: windowStart, end: windowEnd },
      totalSleepTime,
      cycles: clampedCycles,
      fallAsleepEnd,
      wakeUpAtEndOfCycle,
      confidence,
      reasoning,
      alternativeBedtimes,
    };
  }

  calculateFromSchedule(schedule: SleepSchedule, date: Date = new Date()): BedtimeResult {
    const [hours, minutes] = schedule.targetWakeTime.split(':').map(Number);
    const targetDate = new Date(date);
    targetDate.setHours(hours, minutes, 0, 0);
    
    if (targetDate <= date) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    return this.calculate({
      targetWakeTime: targetDate.getTime(),
      sleepCycleLength: schedule.sleepCycleLength,
      desiredCycles: schedule.desiredCycles,
      fallAsleepDuration: schedule.fallAsleepDuration,
      chronotype: schedule.chronotype,
    });
  }

  getNextBedtimeNotification(result: BedtimeResult, config: BedtimeCalculationInput['bedtimeWindowStart'] & { reminderBeforeMinutes: number; windDownStartMinutes: number }): {
    windDownTime: number;
    reminderTime: number;
    bedtimeTime: number;
  } {
    const windDownTime = result.idealBedtime - (config?.windDownStartMinutes || 30) * 60 * 1000;
    const reminderTime = result.idealBedtime - (config?.reminderBeforeMinutes || 15) * 60 * 1000;
    
    return {
      windDownTime,
      reminderTime,
      bedtimeTime: result.idealBedtime,
    };
  }

  private isWakeAtCycleBoundary(wakeTime: number, fallAsleepEnd: number, cycleLength: number): boolean {
    const sleepDuration = wakeTime - fallAsleepEnd;
    const remainder = sleepDuration % cycleLength;
    const tolerance = 10 * 60 * 1000;
    return remainder <= tolerance || (cycleLength - remainder) <= tolerance;
  }

  private calculateConfidence(input: BedtimeCalculationInput, wakeAtBoundary: boolean): number {
    let confidence = 0.7;
    
    if (wakeAtBoundary) confidence += 0.2;
    
    const { desiredCycles = DEFAULT_DESIRED_CYCLES, fallAsleepDuration = DEFAULT_FALL_ASLEEP_DURATION } = input;
    
    if (desiredCycles >= 4 && desiredCycles <= 5) confidence += 0.1;
    if (fallAsleepDuration >= 10 * 60 * 1000 && fallAsleepDuration <= 30 * 60 * 1000) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  private generateReasoning(input: BedtimeCalculationInput, wakeAtBoundary: boolean, confidence: number): string[] {
    const reasoning: string[] = [];
    const { desiredCycles = DEFAULT_DESIRED_CYCLES, fallAsleepDuration = DEFAULT_FALL_ASLEEP_DURATION, chronotype = 'intermediate' } = input;
    
    reasoning.push(`${desiredCycles} cycles de ${Math.round((DEFAULT_SLEEP_CYCLE_LENGTH + CHRONOTYPE_ADJUSTMENTS[chronotype].cycleLength) / 60000)}min = ${Math.round(desiredCycles * (DEFAULT_SLEEP_CYCLE_LENGTH + CHRONOTYPE_ADJUSTMENTS[chronotype].cycleLength) / 3600000 * 10) / 10}h de sommeil`);
    reasoning.push(`Endormissement estimé: ${Math.round((fallAsleepDuration + CHRONOTYPE_ADJUSTMENTS[chronotype].fallAsleep) / 60000)}min`);
    
    if (wakeAtBoundary) {
      reasoning.push('✅ Réveil en fin de cycle (phase légère)');
    } else {
      reasoning.push('⚠️ Réveil potentiellement en milieu de cycle');
    }
    
    if (chronotype !== 'intermediate') {
      reasoning.push(`Chronotype ${chronotype}: ajustement ${CHRONOTYPE_ADJUSTMENTS[chronotype].cycleLength > 0 ? '+' : ''}${Math.round(CHRONOTYPE_ADJUSTMENTS[chronotype].cycleLength / 60000)}min/cycle`);
    }
    
    reasoning.push(`Confiance: ${Math.round(confidence * 100)}%`);
    
    return reasoning;
  }

  private generateAlternatives(
    input: BedtimeCalculationInput,
    adjustedCycleLength: number,
    adjustedFallAsleep: number
  ): AlternativeBedtime[] {
    const { targetWakeTime, desiredCycles = DEFAULT_DESIRED_CYCLES } = input;
    const alternatives: AlternativeBedtime[] = [];
    
    for (let cycles = MIN_CYCLES; cycles <= MAX_CYCLES; cycles++) {
      if (cycles === desiredCycles) continue;
      
      const totalSleepTime = cycles * adjustedCycleLength + adjustedFallAsleep;
      const bedtime = targetWakeTime - totalSleepTime;
      
      alternatives.push({
        bedtime,
        cycles,
        totalSleepTime,
        pros: cycles > desiredCycles 
          ? `Plus de récupération (${cycles} cycles)`
          : `Plus de temps libre le soir (${cycles} cycles)`,
        cons: cycles > desiredCycles
          ? 'Coucher plus tôt nécessaire'
          : 'Risque de dette de sommeil',
      });
    }
    
    return alternatives.sort((a, b) => Math.abs(a.cycles - desiredCycles) - Math.abs(b.cycles - desiredCycles));
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}min`;
  }
}

export function createBedtimeCalculator(): BedtimeCalculator {
  return new BedtimeCalculator();
}