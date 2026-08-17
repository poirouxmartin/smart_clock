import { useState, useEffect, useCallback } from 'react';
import { LightController, getLightController } from './LightController';
import { LightDevice, LightState, LightScene, WakeUpLightConfig } from './types';

export function useLightController(config?: ConstructorParameters<typeof getLightController>[0]) {
  const [controller] = useState(() => getLightController(config));
  const [devices, setDevices] = useState<LightDevice[]>([]);
  const [deviceStates, setDeviceStates] = useState<Map<string, LightState>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await controller.initialize();
      if (mounted) {
        setDevices(controller.getAllDevices());
        setInitialized(true);
      }
    };

    const unsubscribeDevices = controller.onDeviceListChange((devs) => {
      if (mounted) setDevices(devs);
    });

    const unsubscribeState = controller.onStateChange((id, state) => {
      if (mounted) {
        setDeviceStates(prev => {
          const next = new Map(prev);
          next.set(id, state);
          return next;
        });
      }
    });

    init();

    return () => {
      mounted = false;
      unsubscribeDevices();
      unsubscribeState();
    };
  }, [controller]);

  const discover = useCallback(async () => {
    setDiscovering(true);
    try {
      await controller.discoverDevices();
    } finally {
      setDiscovering(false);
    }
  }, [controller]);

  const getDeviceState = useCallback((deviceId: string): LightState | undefined => {
    return deviceStates.get(deviceId);
  }, [deviceStates]);

  const turnOn = useCallback(async (deviceId: string, transitionTime?: number) => {
    await controller.turnOn(deviceId, transitionTime);
  }, [controller]);

  const turnOff = useCallback(async (deviceId: string, transitionTime?: number) => {
    await controller.turnOff(deviceId, transitionTime);
  }, [controller]);

  const setBrightness = useCallback(async (deviceId: string, brightness: number, transitionTime?: number) => {
    await controller.setBrightness(deviceId, brightness, transitionTime);
  }, [controller]);

  const setColorTemperature = useCallback(async (deviceId: string, temp: number, transitionTime?: number) => {
    await controller.setColorTemperature(deviceId, temp, transitionTime);
  }, [controller]);

  const setColor = useCallback(async (deviceId: string, r: number, g: number, b: number, transitionTime?: number) => {
    await controller.setColor(deviceId, r, g, b, transitionTime);
  }, [controller]);

  const executeWakeUpLight = useCallback(async (deviceIds: string[], config?: Partial<WakeUpLightConfig>) => {
    await controller.executeWakeUpLight(deviceIds, config);
  }, [controller]);

  const cancelWakeUpLight = useCallback(() => {
    controller.cancelWakeUpLight();
  }, [controller]);

  const applyScene = useCallback(async (scene: LightScene) => {
    await controller.applyScene(scene);
  }, [controller]);

  const createScene = useCallback((id: string, name: string, transitionTime?: number) => {
    return controller.createScene(id, name, transitionTime);
  }, [controller]);

  const removeDevice = useCallback((deviceId: string) => {
    controller.removeDevice(deviceId);
  }, [controller]);

  return {
    controller,
    devices,
    deviceStates,
    initialized,
    discovering,
    discover,
    getDeviceState,
    turnOn,
    turnOff,
    setBrightness,
    setColorTemperature,
    setColor,
    executeWakeUpLight,
    cancelWakeUpLight,
    applyScene,
    createScene,
    removeDevice,
    connectedDevices: devices.filter(d => d.isConnected),
  };
}

export function useWakeUpLight(
  deviceIds: string[],
  config: WakeUpLightConfig
) {
  const { executeWakeUpLight, cancelWakeUpLight } = useLightController();
  const [scheduled, setScheduled] = useState(false);

  const schedule = useCallback((alarmTime: number) => {
    const startTime = alarmTime - config.startBeforeAlarm;
    const delay = Math.max(0, startTime - Date.now());
    
    if (delay > 0) {
      setTimeout(() => {
        executeWakeUpLight(deviceIds, config);
      }, delay);
      setScheduled(true);
    } else {
      executeWakeUpLight(deviceIds, config);
      setScheduled(true);
    }
  }, [executeWakeUpLight, deviceIds, config]);

  const cancel = useCallback(() => {
    cancelWakeUpLight();
    setScheduled(false);
  }, [cancelWakeUpLight]);

  return { schedule, cancel, scheduled };
}