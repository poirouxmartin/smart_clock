import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { AlarmSetupScreen } from '@/screens/AlarmSetupScreen';
import { SleepAnalysisScreen } from '@/screens/SleepAnalysisScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DevToolsScreen } from '@/dev/DevToolsScreen';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="AlarmSetup" component={AlarmSetupScreen} />
      <Stack.Screen name="SleepAnalysis" component={SleepAnalysisScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevTools" component={DevToolsScreen} />
    </Stack.Navigator>
  );
}