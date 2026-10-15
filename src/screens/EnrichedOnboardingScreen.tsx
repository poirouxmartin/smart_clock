import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { getUserProfileManager } from '@/modules/user-profile';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'EnrichedOnboarding'>;

interface QuestionOption {
  label: string;
  value: number;
}

interface Question {
  id: string;
  question: string;
  icon: keyof typeof Ionicons.glyphMap;
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'wake_time',
    question: 'À quelle heure vous réveillez-vous naturellement ?',
    icon: 'alarm-outline',
    options: [
      { label: 'Avant 6h', value: -2 },
      { label: '6h - 7h', value: -1 },
      { label: '7h - 8h', value: 0 },
      { label: '8h - 9h', value: 1 },
      { label: 'Après 9h', value: 2 },
    ],
  },
  {
    id: 'fall_asleep',
    question: 'Combien de temps mettez-vous pour vous endormir ?',
    icon: 'hourglass-outline',
    options: [
      { label: 'Moins de 5 min', value: -2 },
      { label: '5 - 15 min', value: -1 },
      { label: '15 - 30 min', value: 0 },
      { label: '30 - 60 min', value: 1 },
      { label: "Plus d'1h", value: 2 },
    ],
  },
  {
    id: 'awakenings',
    question: 'Combien de fois vous réveillez-vous la nuit ?',
    icon: 'eye-off-outline',
    options: [
      { label: 'Jamais', value: -2 },
      { label: '1 - 2 fois', value: -1 },
      { label: '3 - 4 fois', value: 0 },
      { label: '5+ fois', value: 1 },
    ],
  },
  {
    id: 'caffeine',
    question: 'Buvez-vous de la caféine après 14h ?',
    icon: 'wine-outline',
    options: [
      { label: 'Non', value: -2 },
      { label: 'Rarement', value: -1 },
      { label: 'Parfois', value: 0 },
      { label: 'Souvent', value: 1 },
      { label: 'Toujours', value: 2 },
    ],
  },
  {
    id: 'screens',
    question: "Regardez-vous des écrans dans l'heure avant le coucher ?",
    icon: 'phone-portrait-outline',
    options: [
      { label: 'Non', value: -2 },
      { label: 'Rarement', value: -1 },
      { label: 'Parfois', value: 0 },
      { label: 'Souvent', value: 1 },
      { label: 'Toujours', value: 2 },
    ],
  },
  {
    id: 'exercise',
    question: 'Faites-vous du sport régulièrement ?',
    icon: 'barbell-outline',
    options: [
      { label: 'Tous les jours', value: -2 },
      { label: '3 - 5x/semaine', value: -1 },
      { label: '1 - 2x/semaine', value: 0 },
      { label: 'Rarement', value: 1 },
      { label: 'Jamais', value: 2 },
    ],
  },
  {
    id: 'naps',
    question: 'Faites-vous des siestes ?',
    icon: 'timer-outline',
    options: [
      { label: 'Non', value: -2 },
      { label: 'Courtes < 20 min', value: -1 },
      { label: '20 - 60 min', value: 0 },
      { label: 'Longues > 1h', value: 1 },
    ],
  },
  {
    id: 'environment',
    question: 'Comment décririez-vous votre environnement de sommeil ?',
    icon: 'home-outline',
    options: [
      { label: 'Parfait - sombre et calme', value: -2 },
      { label: 'Bon', value: -1 },
      { label: 'Correct', value: 0 },
      { label: 'Bruyant / lumineux', value: 1 },
      { label: 'Très mauvais', value: 2 },
    ],
  },
];

type SleepProfile = {
  chronotype: 'morning' | 'evening' | 'intermediate';
  fallAsleepDuration: number;
  awakeningsPerNight: number;
  caffeineAfter2pm: boolean;
  screensBeforeBed: boolean;
  exerciseFrequency: 'daily' | 'regular' | 'occasional' | 'rare' | 'never';
  napHabit: 'none' | 'short' | 'medium' | 'long';
  sleepEnvironment: 'perfect' | 'good' | 'ok' | 'noisy' | 'terrible';
};

function computeChronotype(total: number): SleepProfile['chronotype'] {
  if (total <= -3) return 'morning';
  if (total >= 3) return 'evening';
  return 'intermediate';
}

function computeFallAsleepDuration(value: number): number {
  const map: Record<number, number> = {
    [-2]: 5 * 60 * 1000,
    [-1]: 15 * 60 * 1000,
    [0]: 30 * 60 * 1000,
    [1]: 60 * 60 * 1000,
    [2]: 90 * 60 * 1000,
  };
  return map[value] ?? 15 * 60 * 1000;
}

function computeAwakenings(value: number): number {
  const map: Record<number, number> = {
    [-2]: 0,
    [-1]: 1,
    [0]: 3,
    [1]: 5,
  };
  return map[value] ?? 0;
}

function computeExerciseFrequency(value: number): SleepProfile['exerciseFrequency'] {
  const map: Record<number, SleepProfile['exerciseFrequency']> = {
    [-2]: 'daily',
    [-1]: 'regular',
    [0]: 'occasional',
    [1]: 'rare',
    [2]: 'never',
  };
  return map[value] ?? 'occasional';
}

function computeNapHabit(value: number): SleepProfile['napHabit'] {
  const map: Record<number, SleepProfile['napHabit']> = {
    [-2]: 'none',
    [-1]: 'short',
    [0]: 'medium',
    [1]: 'long',
  };
  return map[value] ?? 'none';
}

function computeSleepEnvironment(value: number): SleepProfile['sleepEnvironment'] {
  const map: Record<number, SleepProfile['sleepEnvironment']> = {
    [-2]: 'perfect',
    [-1]: 'good',
    [0]: 'ok',
    [1]: 'noisy',
    [2]: 'terrible',
  };
  return map[value] ?? 'ok';
}

function computeProfile(answers: Record<string, number>): SleepProfile {
  const wakeTimeValue = answers['wake_time'] ?? 0;
  const fallAsleepValue = answers['fall_asleep'] ?? 0;
  const awakeningsValue = answers['awakenings'] ?? 0;
  const caffeineValue = answers['caffeine'] ?? 0;
  const screensValue = answers['screens'] ?? 0;
  const exerciseValue = answers['exercise'] ?? 0;
  const napsValue = answers['naps'] ?? 0;
  const environmentValue = answers['environment'] ?? 0;

  return {
    chronotype: computeChronotype(wakeTimeValue),
    fallAsleepDuration: computeFallAsleepDuration(fallAsleepValue),
    awakeningsPerNight: computeAwakenings(awakeningsValue),
    caffeineAfter2pm: caffeineValue >= 0,
    screensBeforeBed: screensValue >= 0,
    exerciseFrequency: computeExerciseFrequency(exerciseValue),
    napHabit: computeNapHabit(napsValue),
    sleepEnvironment: computeSleepEnvironment(environmentValue),
  };
}

const CHRONOTYPE_LABELS: Record<SleepProfile['chronotype'], string> = {
  morning: 'Couche-tôt',
  evening: 'Couche-tard',
  intermediate: 'Intermédiaire',
};

const CHRONOTYPE_DESCRIPTIONS: Record<SleepProfile['chronotype'], string> = {
  morning: 'Vous êtes plus productif le matin et vous vous couchez tôt.',
  evening: 'Vous êtes plus productif le soir et vous vous couchez tard.',
  intermediate: 'Vous avez un rythme de sommeil équilibré.',
};

const EXERCISE_LABELS: Record<SleepProfile['exerciseFrequency'], string> = {
  daily: 'Tous les jours',
  regular: '3-5x/semaine',
  occasional: '1-2x/semaine',
  rare: 'Rarement',
  never: 'Jamais',
};

const NAP_LABELS: Record<SleepProfile['napHabit'], string> = {
  none: 'Aucune',
  short: 'Courte < 20 min',
  medium: '20 - 60 min',
  long: 'Longue > 1h',
};

const ENVIRONMENT_LABELS: Record<SleepProfile['sleepEnvironment'], string> = {
  perfect: 'Parfait - sombre et calme',
  good: 'Bon',
  ok: 'Correct',
  noisy: 'Bruyant / lumineux',
  terrible: 'Très mauvais',
};

export function EnrichedOnboardingScreen() {
  const navigation = useNavigation<Navigation>();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const progress = useMemo(
    () => (currentQuestion + 1) / QUESTIONS.length,
    [currentQuestion]
  );

  const question = QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion >= QUESTIONS.length;
  const hasAnswer = question ? answers[question.id] !== undefined : false;

  const profile = useMemo(() => computeProfile(answers), [answers]);

  const handleSelect = useCallback(
    (value: number) => {
      if (!question) return;
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    },
    [question]
  );

  const handleNext = useCallback(() => {
    if (!hasAnswer) return;
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setCurrentQuestion(QUESTIONS.length);
    }
  }, [currentQuestion, hasAnswer]);

  const handleBack = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  }, [currentQuestion]);

  const handleSkip = useCallback(() => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setCurrentQuestion(QUESTIONS.length);
    }
  }, [currentQuestion]);

  const handleStart = useCallback(async () => {
    setSaving(true);
    try {
      const manager = getUserProfileManager();
      await manager.updateProfile({
        chronotype: profile.chronotype,
        fallAsleepDuration: profile.fallAsleepDuration,
        onboardingComplete: true,
      });
      await manager.updateSleepPreferences({
        chronotype: profile.chronotype,
        fallAsleepDuration: profile.fallAsleepDuration,
      });
      navigation.replace('Home');
    } catch (e) {
      console.error('Enriched onboarding save error:', e);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  }, [profile, navigation]);

  const formatDuration = (ms: number): string => {
    const minutes = Math.round(ms / (60 * 1000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
  };

  if (isLastQuestion) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={Colors.gradient.night}
          style={styles.gradient}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Ionicons name="checkmark-circle-outline" size={56} color={Colors.success} />
              <Text style={styles.title}>Votre profil de sommeil</Text>
              <Text style={styles.subtitle}>
                Voici le résumé de vos réponses
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="moon-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Chronotype</Text>
              </View>
              <Text style={styles.cardValue}>{CHRONOTYPE_LABELS[profile.chronotype]}</Text>
              <Text style={styles.cardDesc}>{CHRONOTYPE_DESCRIPTIONS[profile.chronotype]}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="hourglass-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Temps pour s'endormir</Text>
              </View>
              <Text style={styles.cardValue}>{formatDuration(profile.fallAsleepDuration)}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="eye-off-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Réveils nocturnes</Text>
              </View>
              <Text style={styles.cardValue}>
                {profile.awakeningsPerNight === 0
                  ? 'Jamais'
                  : `${profile.awakeningsPerNight} fois`}
              </Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.card, styles.halfCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="wine-outline" size={20} color={Colors.primaryLight} />
                  <Text style={[styles.cardTitle, { fontSize: 13 }]}>Caféine après 14h</Text>
                </View>
                <Text style={styles.cardValue}>
                  {profile.caffeineAfter2pm ? 'Oui' : 'Non'}
                </Text>
              </View>
              <View style={[styles.card, styles.halfCard]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="phone-portrait-outline" size={20} color={Colors.primaryLight} />
                  <Text style={[styles.cardTitle, { fontSize: 13 }]}>Écrans avant coucher</Text>
                </View>
                <Text style={styles.cardValue}>
                  {profile.screensBeforeBed ? 'Oui' : 'Non'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="barbell-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Activité physique</Text>
              </View>
              <Text style={styles.cardValue}>{EXERCISE_LABELS[profile.exerciseFrequency]}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="timer-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Siestes</Text>
              </View>
              <Text style={styles.cardValue}>{NAP_LABELS[profile.napHabit]}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="home-outline" size={22} color={Colors.primaryLight} />
                <Text style={styles.cardTitle}>Environnement de sommeil</Text>
              </View>
              <Text style={styles.cardValue}>{ENVIRONMENT_LABELS[profile.sleepEnvironment]}</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={saving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.purple]}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? 'Chargement...' : 'Commencer'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={Colors.gradient.night} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[Colors.primary, Colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              Question {currentQuestion + 1} / {QUESTIONS.length}
            </Text>
          </View>

          <View style={styles.questionCard}>
            <View style={styles.iconContainer}>
              <Ionicons name={question.icon} size={32} color={Colors.primaryLight} />
            </View>
            <Text style={styles.questionText}>{question.question}</Text>

            <View style={styles.optionsList}>
              {question.options.map((opt) => {
                const isSelected = answers[question.id] === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, currentQuestion === 0 && styles.buttonHidden]}
              onPress={handleBack}
              disabled={currentQuestion === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back-outline" size={20} color={Colors.textMuted} />
              <Text style={styles.secondaryButtonText}>Retour</Text>
            </TouchableOpacity>

            <View style={styles.navRight}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>Passer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButtonSmall, !hasAnswer && styles.buttonDisabled]}
                onPress={handleNext}
                disabled={!hasAnswer}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    hasAnswer
                      ? [Colors.primary, Colors.purple]
                      : [Colors.bgSurface, Colors.bgSurface]
                  }
                  style={styles.primaryButtonSmallGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryButtonText}>
                    {currentQuestion === QUESTIONS.length - 1 ? 'Voir le résultat' : 'Suivant'}
                  </Text>
                  {currentQuestion < QUESTIONS.length - 1 && (
                    <Ionicons name="arrow-forward-outline" size={18} color={Colors.text} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: Spacing.xl,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressText: {
    ...Typography.caption,
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  questionText: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 30,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.bgCardAlt,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  optionLabel: {
    ...Typography.body,
    flex: 1,
  },
  optionLabelSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginLeft: 'auto',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  buttonHidden: {
    opacity: 0,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipButtonText: {
    ...Typography.bodySmall,
    color: Colors.textDim,
    textDecorationLine: 'underline',
  },
  primaryButtonSmall: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  primaryButtonSmallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySmall,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  cardValue: {
    ...Typography.h2,
    color: Colors.primaryLight,
  },
  cardDesc: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  halfCard: {
    flex: 1,
    marginBottom: 0,
  },
  primaryButton: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginTop: Spacing.lg,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
