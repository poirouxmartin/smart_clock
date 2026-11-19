import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { SleepModeScreen } from '@/screens/SleepModeScreen';
import { NightSummaryScreen } from '@/screens/NightSummaryScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AlarmScreen } from '@/screens/AlarmScreen';
import { CustomSoundsScreen } from '@/screens/CustomSoundsScreen';
import { LightsScreen } from '@/screens/LightsScreen';
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
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SleepMode" component={SleepModeScreen} />
      <Stack.Screen name="NightSummary" component={NightSummaryScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Alarm" component={AlarmScreen} />
      <Stack.Screen name="CustomSounds" component={CustomSoundsScreen} />
      <Stack.Screen name="Lights" component={LightsScreen} />
    </Stack.Navigator>
  );
}
