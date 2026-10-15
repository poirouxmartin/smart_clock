import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/LoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { AlarmSetupScreen } from '@/screens/AlarmSetupScreen';
import { SleepAnalysisScreen } from '@/screens/SleepAnalysisScreen';
import { SleepModeScreen } from '@/screens/SleepModeScreen';
import { NightSummaryScreen } from '@/screens/NightSummaryScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { CustomSoundsScreen } from '@/screens/CustomSoundsScreen';
import { LightsScreen } from '@/screens/LightsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { EnrichedOnboardingScreen } from '@/screens/EnrichedOnboardingScreen';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="EnrichedOnboarding" component={EnrichedOnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="AlarmSetup" component={AlarmSetupScreen} />
      <Stack.Screen name="SleepAnalysis" component={SleepAnalysisScreen} />
      <Stack.Screen name="SleepMode" component={SleepModeScreen} />
      <Stack.Screen name="NightSummary" component={NightSummaryScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CustomSounds" component={CustomSoundsScreen} />
      <Stack.Screen name="Lights" component={LightsScreen} />
    </Stack.Navigator>
  );
}
