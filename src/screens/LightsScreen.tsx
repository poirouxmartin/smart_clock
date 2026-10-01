import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '@/modules/i18n';
import { getLightController } from '@/modules/light-controller';
import type { RootStackParamList } from '@/types';

type LightsNav = React.NavigationProp<RootStackParamList, 'Lights'>;

export function LightsScreen() {
  const navigation = useNavigation<LightsNav>();
  const { t, tCommon, tLights } = useI18n();
  
  const [devices, setDevices] = useState<Array<any>>([]);
  const [deviceStates, setDeviceStates] = useState<Map<string, any>>(new Map());
  const [discovering, setDiscovering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDevices = async () => {
      const lightController = getLightController();
      await lightController.initialize();
      
      const deviceList = lightController.getAllDevices();
      setDevices(deviceList);
      
      const states = new Map<string, any>();
      deviceList.forEach(d => {
        const state = lightController.getDevice(d.id)?.getState?.() || { on: false, brightness: 0 };
        states.set(d.id, state);
      });
      setDeviceStates(states);
      
      const unsubscribeDevices = lightController.onDeviceListChange((devs) => {
        setDevices(devs);
      });
      
      const unsubscribeState = lightController.onStateChange((id, state) => {
        setDeviceStates(prev => {
          const next = new Map(prev);
          next.set(id, state);
          return next;
        });
      });
      
      setLoading(false);
      
      return () => {
        unsubscribeDevices();
        unsubscribeState();
      };
    };
    loadDevices();
  }, []);

  const discover = useCallback(async () => {
    setDiscovering(true);
    try {
      const lightController = getLightController();
      await lightController.discoverDevices(10000);
    } finally {
      setDiscovering(false);
    }
  }, []);

  const toggleDevice = useCallback(async (deviceId: string, currentState: any) => {
    const lightController = getLightController();
    await lightController.turnOn(deviceId, 1000);
  }, []);

  const setBrightness = useCallback(async (deviceId: string, brightness: number) => {
    const lightController = getLightController();
    await lightController.setBrightness(deviceId, brightness, 2000);
  }, []);

  const setColorTemp = useCallback(async (deviceId: string, temp: number) => {
    const lightController = getLightController();
    await lightController.setColorTemperature(deviceId, temp, 2000);
  }, []);

  const testWakeUpLight = useCallback(async (deviceId: string) => {
    const lightController = getLightController();
    await lightController.executeWakeUpLight([deviceId], { duration: 10000, startBeforeAlarm: 0 });
  }, []);

  const removeDevice = useCallback(async (deviceId: string) => {
    Alert.alert(
      tCommon('confirm'),
      tCommon('delete') + ' ?',
      [
        { text: tCommon('cancel'), style: 'cancel' },
        { 
          text: tCommon('delete'), 
          style: 'destructive', 
          onPress: () => {
            const lightController = getLightController();
            lightController.removeDevice(deviceId);
          }
        }
      ]
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderDevice = (device: any) => {
    const state = deviceStates.get(device.id) || { on: false, brightness: 0 };
    return (
      <View style={styles.deviceCard} key={device.id}>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={styles.deviceType}>{device.type} • {device.isConnected ? '🟢 ' + tCommon('on') : '🔴 ' + tCommon('off')}</Text>
          </View>
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => removeDevice(device.id)}>
            <Text style={styles.actionButtonText}>🗑</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.deviceControls}>
          <TouchableOpacity 
            style={[styles.controlButton, state.on ? styles.controlButtonActive : '']} 
            onPress={() => toggleDevice(device.id, state)}
          >
            <Text style={styles.controlButtonText}>{state.on ? '💡 ' + tLights('on') : '⭕ ' + tLights('off')}</Text>
          </TouchableOpacity>
          
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>{tLights('brightness')}</Text>
            <View style={styles.slider}>
              <View style={{ width: `${state.brightness}%`, height: '100%', backgroundColor: '#0ea5e9', borderRadius: 2 }} />
            </View>
            <Text style={styles.sliderValue}>{state.brightness}%</Text>
          </View>
          
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>{tLights('colorTemperature')}</Text>
            <TouchableOpacity style={styles.tempButton} onPress={() => setColorTemp(device.id, 3000)}>
              <Text style={styles.tempButtonText}>3000K</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tempButton} onPress={() => setColorTemp(device.id, 4000)}>
              <Text style={styles.tempButtonText}>4000K</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tempButton} onPress={() => setColorTemp(device.id, 5000)}>
              <Text style={styles.tempButtonText}>5000K</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tempButton} onPress={() => setColorTemp(device.id, 6500)}>
              <Text style={styles.tempButtonText}>6500K</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={[styles.button, styles.buttonSecondary, styles.testButton]} onPress={() => testWakeUpLight(device.id)}>
            <Text style={styles.buttonText}>{tLights('testWakeUpLight')} (10s)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{tCommon('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{tCommon('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tLights('title')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tLights('discoverDevices')}</Text>
          <TouchableOpacity style={[styles.button, styles.buttonPrimary, discovering && styles.buttonDisabled]} onPress={discover} disabled={discovering}>
            <Text style={styles.buttonText}>{discovering ? '🔄 ' + tCommon('loading') : tLights('discoverDevices')}</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>{tLights('philipsHue')}, {tLights('yeelight')}, {tLights('matter')}, {tLights('wiz')}, {tLights('tuya')}</Text>
        </View>

        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{tLights('noDevices')}</Text>
            <Text style={styles.emptySubtext}>{tLights('discoverDevices')}</Text>
          </View>
        ) : (
          devices.map(renderDevice)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b9cb3', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backText: { color: '#8b9cb3', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '600', color: '#fff' },
  card: { backgroundColor: '#131a2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  cardTitle: { fontSize: 14, color: '#8b9cb3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#0ea5e9' },
  buttonSecondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  helpText: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8 },
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#131a2e', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#8b9cb3' },
  deviceCard: { backgroundColor: '#131a2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  deviceType: { fontSize: 13, color: '#8b9cb3' },
  actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  deleteButton: { backgroundColor: '#ef4444' },
  actionButtonText: { fontSize: 18, color: '#fff' },
  deviceControls: { gap: 12 },
  controlButton: { paddingVertical: 12, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  controlButtonActive: { backgroundColor: '#0ea5e9' },
  controlButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderLabel: { fontSize: 13, color: '#8b9cb3', minWidth: 80 },
  slider: { flex: 1, height: 4, backgroundColor: '#1e293b', borderRadius: 2 },
  sliderValue: { fontSize: 13, color: '#fff', minWidth: 40 },
  tempButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  tempButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  testButton: { marginTop: 8, backgroundColor: '#7c3aed' },
});