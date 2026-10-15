import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/LoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { AlarmSetupScreen } from '@/screens/AlarmSetupScreen';
import { SleepAnalysisScreen } from '@/screens/SleepAnalysisScreen';
import { SleepModeScreen } from '@/screens/SleepModeScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DevToolsScreen } from '@/dev/DevToolsScreen';
import { CustomSoundsScreen } from '@/screens/CustomSoundsScreen';
import { LightsScreen } from '@/screens/LightsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { EnrichedOnboardingScreen } from '@/screens/EnrichedOnboardingScreen';
import { getAuthService } from '@/modules/auth';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getAuthService().restoreSession();
      setInitialRoute(user ? 'Home' : 'Login');
    })();
  }, []);

  if (initialRoute === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
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
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevTools" component={DevToolsScreen} />
      <Stack.Screen name="CustomSounds" component={CustomSoundsScreen} />
      <Stack.Screen name="Lights" component={LightsScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e1a' },
});
