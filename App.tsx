import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from '@/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#0a0e1a" 
          translucent={true} 
        />
        <AppNavigator />
      </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}