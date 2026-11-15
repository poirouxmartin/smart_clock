import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native'; // expo-status-bar has no barStyle/backgroundColor/translucent props
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from '@/navigation/AppNavigator';
import { ThemeProvider, useTheme } from '@/theme';

function ThemedStatusBar() {
  const { palette } = useTheme();
  return (
    <StatusBar
      barStyle={palette.statusBar === 'light' ? 'light-content' : 'dark-content'}
      backgroundColor={palette.bg}
      translucent={true}
    />
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <ThemedStatusBar />
            <AppNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
