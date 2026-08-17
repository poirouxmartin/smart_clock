import { useState, useCallback, useMemo, useEffect } from 'react';
import { BedtimeCalculator, createBedtimeCalculator } from './BedtimeCalculator';
import {
  BedtimeCalculationInput,
  BedtimeResult,
  SleepSchedule,
  BedtimeNotificationConfig,
  CHRONOTYPE_ADJUSTMENTS,
} from './types';

export function useBedtimeCalculator() {
  const [calculator] = useState(() => createBedtimeCalculator());
  const [input, setInput] = useState<BedtimeCalculationInput>({
    targetWakeTime: Date.now() + 8 * 60 * 60 * 1000,
    sleepCycleLength: 90 * 60 * 1000,
    desiredCycles: 5,
    fallAsleepDuration: 15 * 60 * 1000,
    chronotype: 'intermediate',
  });
  const [result, setResult] = useState<BedtimeResult | null>(null);

  useEffect(() => {
    const r = calculator.calculate(input);
    setResult(r);
  }, [calculator, input]);

  const updateTargetWakeTime = useCallback((time: number) => {
    setInput(prev => ({ ...prev, targetWakeTime: time }));
  }, []);

  const updateWakeTimeFromString = useCallback((timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    setInput(prev => ({ ...prev, targetWakeTime: target.getTime() }));
  }, []);

  const updateCycles = useCallback((cycles: number) => {
    setInput(prev => ({ ...prev, desiredCycles: Math.max(3, Math.min(6, cycles)) }));
  }, []);

  const updateFallAsleep = useCallback((minutes: number) => {
    setInput(prev => ({ ...prev, fallAsleepDuration: Math.max(5, Math.min(60, minutes)) * 60 * 1000 }));
  }, []);

  const updateChronotype = useCallback((chronotype: 'morning' | 'evening' | 'intermediate') => {
    setInput(prev => ({ ...prev, chronotype }));
  }, []);

  const updateCycleLength = useCallback((minutes: number) => {
    setInput(prev => ({ ...prev, sleepCycleLength: Math.max(70, Math.min(110, minutes)) * 60 * 1000 }));
  }, []);

  const getBedtimeWindow = useCallback(() => {
    if (!result) return null;
    return {
      ideal: calculator.formatTime(result.idealBedtime),
      windowStart: calculator.formatTime(result.bedtimeWindow.start),
      windowEnd: calculator.formatTime(result.bedtimeWindow.end),
      totalSleep: calculator.formatDuration(result.totalSleepTime),
    };
  }, [calculator, result]);

  const getNotifications = useCallback((config: BedtimeNotificationConfig) => {
    if (!result) return null;
    return calculator.getNextBedtimeNotification(result, config);
  }, [calculator, result]);

  return {
    calculator,
    input,
    result,
    updateTargetWakeTime,
    updateWakeTimeFromString,
    updateCycles,
    updateFallAsleep,
    updateChronotype,
    updateCycleLength,
    getBedtimeWindow,
    getNotifications,
    setInput,
  };
}

export function useBedtimeSchedule(schedule: SleepSchedule) {
  const { calculator, result, getNotifications } = useBedtimeCalculator();
  const [nextBedtime, setNextBedtime] = useState<BedtimeResult | null>(null);

  useEffect(() => {
    if (schedule.enabled) {
      const r = calculator.calculateFromSchedule(schedule);
      setNextBedtime(r);
    }
  }, [calculator, schedule]);

  const notifications = useMemo(() => {
    if (!nextBedtime) return null;
    return getNotifications(schedule.bedtimeNotification);
  }, [nextBedtime, getNotifications, schedule.bedtimeNotification]);

  return {
    nextBedtime,
    notifications,
    isEnabled: schedule.enabled,
  };
}

export function useChronotypeRecommendation() {
  const [chronotype, setChronotype] = useState<'morning' | 'evening' | 'intermediate'>('intermediate');
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const questions = [
    {
      id: 'wake_preference',
      question: 'À quelle heure vous réveillez-vous naturellement (sans alarme) ?',
      options: [
        { label: 'Avant 6h', value: -2 },
        { label: '6h-7h', value: -1 },
        { label: '7h-8h', value: 0 },
        { label: '8h-9h', value: 1 },
        { label: 'Après 9h', value: 2 },
      ],
    },
    {
      id: 'sleep_preference',
      question: 'À quelle heure vous endormez-vous naturellement ?',
      options: [
        { label: 'Avant 22h', value: -2 },
        { label: '22h-23h', value: -1 },
        { label: '23h-00h', value: 0 },
        { label: '00h-1h', value: 1 },
        { label: 'Après 1h', value: 2 },
      ],
    },
    {
      id: 'energy_morning',
      question: 'Votre niveau d\'énergie le matin :',
      options: [
        { label: 'Très énergique', value: -2 },
        { label: 'Énergique', value: -1 },
        { label: 'Moyen', value: 0 },
        { label: 'Fatigué', value: 1 },
        { label: 'Très fatigué', value: 2 },
      ],
    },
    {
      id: 'energy_evening',
      question: 'Votre niveau d\'énergie le soir :',
      options: [
        { label: 'Très fatigué', value: -2 },
        { label: 'Fatigué', value: -1 },
        { label: 'Moyen', value: 0 },
        { label: 'Énergique', value: 1 },
        { label: 'Très énergique', value: 2 },
      ],
    },
  ];

  const answerQuestion = useCallback((questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    
    const total = Object.values(answers).reduce((a, b) => a + b, 0) + value;
    if (total <= -3) setChronotype('morning');
    else if (total >= 3) setChronotype('evening');
    else setChronotype('intermediate');
  }, [answers]);

  const getAdjustment = useCallback(() => CHRONOTYPE_ADJUSTMENTS[chronotype], [chronotype]);

  return {
    chronotype,
    questions,
    answers,
    answerQuestion,
    getAdjustment,
    reset: () => {
      setAnswers({});
      setChronotype('intermediate');
    },
  };
}