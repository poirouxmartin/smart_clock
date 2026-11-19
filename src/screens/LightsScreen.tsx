import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/modules/i18n';
import { getLightController } from '@/modules/light-controller';
import { Screen, Card } from '@/components/Screen';
import { makeTypography, Spacing, Radius, useTheme, useThemedStyles, type Palette } from '@/theme';

export function LightsScreen() {
  const { tCommon, tLights } = useI18n();
  const { palette: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  
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
      tCommon('confirmQuestion', { what: tCommon('delete') }),
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

  const renderDevice = (device: any) => {
    const state = deviceStates.get(device.id) || { on: false, brightness: 0 };
    return (
      <Card key={device.id}>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={styles.deviceType}>{device.type} • {device.isConnected ? '🟢 ' + tCommon('on') : '🔴 ' + tCommon('off')}</Text>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={() => removeDevice(device.id)}>
            <Ionicons name="trash-outline" size={18} color={c.danger} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.deviceControls}>
          <TouchableOpacity 
            style={[styles.controlButton, state.on ? styles.controlButtonActive : null]} 
            onPress={() => toggleDevice(device.id, state)}
          >
            <Text style={styles.controlButtonText}>{state.on ? '💡 ' + tLights('on') : '⭕ ' + tLights('off')}</Text>
          </TouchableOpacity>
          
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>{tLights('brightness')}</Text>
            <View style={styles.slider}>
              <View style={{ width: `${state.brightness}%`, height: '100%', backgroundColor: c.primary, borderRadius: 2 }} />
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
            <Text style={styles.buttonText}>{tCommon('withDetail', { text: tLights('testWakeUpLight'), detail: tCommon('seconds', { count: 10 }) })}</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <Screen title={tLights('title')} icon="bulb-outline">
      {loading ? (
        <Text style={styles.helpText}>{tCommon('loading')}</Text>
      ) : (
        <>
          <Card title={tLights('discoverDevices')}>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary, discovering && styles.buttonDisabled]} onPress={discover} disabled={discovering}>
              <Text style={styles.buttonText}>{discovering ? '🔄 ' + tCommon('loading') : tLights('discoverDevices')}</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>{tLights('philipsHue')}, {tLights('yeelight')}, {tLights('matter')}, {tLights('wiz')}, {tLights('tuya')}</Text>
          </Card>

          {devices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{tLights('noDevices')}</Text>
              <Text style={styles.emptySubtext}>{tLights('discoverDevices')}</Text>
            </View>
          ) : (
            devices.map(renderDevice)
          )}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) => {
  const T = makeTypography(c);
  return StyleSheet.create({
    button: { paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center' },
    buttonPrimary: { backgroundColor: c.primary },
    buttonSecondary: { backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.borderLight },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...T.body, color: c.onPrimary, fontWeight: '600' },
    helpText: { ...T.caption, textAlign: 'center', marginTop: Spacing.sm },
    emptyState: { padding: 40, alignItems: 'center', backgroundColor: c.bgCard + 'e6', borderRadius: 24, borderWidth: 1, borderColor: c.border },
    emptyText: { ...T.h3, marginBottom: Spacing.sm },
    emptySubtext: { ...T.bodySmall, color: c.textMuted },
    deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    deviceInfo: { flex: 1 },
    deviceName: { ...T.h3 },
    deviceType: { ...T.caption },
    actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center' },
    deviceControls: { gap: Spacing.md },
    controlButton: { paddingVertical: Spacing.md, borderRadius: Radius.sm, backgroundColor: c.bgSurface, alignItems: 'center' },
    controlButtonActive: { backgroundColor: c.primary },
    controlButtonText: { ...T.bodySmall, color: c.text, fontWeight: '600' },
    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    sliderLabel: { ...T.caption, minWidth: 80 },
    slider: { flex: 1, height: 4, backgroundColor: c.bgSurface, borderRadius: 2 },
    sliderValue: { ...T.caption, color: c.text, minWidth: 40 },
    tempButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: c.bgSurface, alignItems: 'center' },
    tempButtonText: { ...T.caption, color: c.text, fontWeight: '600' },
    testButton: { marginTop: Spacing.sm, backgroundColor: c.accent },
  });
};
