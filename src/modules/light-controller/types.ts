export interface LightDevice {
  id: string;
  name: string;
  type: 'hue' | 'yeelight' | 'wiz' | 'tuya' | 'matter' | 'generic';
  address: string;
  port?: number;
  token?: string;
  capabilities: LightCapabilities;
  isConnected: boolean;
  lastSeen: number;
}

export interface LightCapabilities {
  brightness: boolean;
  colorTemperature: boolean;
  color: boolean;
  effects: boolean;
  minBrightness: number;
  maxBrightness: number;
  minColorTemp: number;
  maxColorTemp: number;
}

export interface LightState {
  on: boolean;
  brightness: number;
  colorTemperature?: number;
  color?: { r: number; g: number; b: number };
  effect?: string;
  transitionTime?: number;
}

export interface LightControllerConfig {
  autoDiscover: boolean;
  discoveryTimeout: number;
  reconnectInterval: number;
  defaultTransitionTime: number;
  wakeUpLightConfig: WakeUpLightConfig;
}

export const DEFAULT_LIGHT_CONFIG: LightControllerConfig = {
  autoDiscover: true,
  discoveryTimeout: 10000,
  reconnectInterval: 30000,
  defaultTransitionTime: 1000,
  wakeUpLightConfig: {
    enabled: true,
    startBrightness: 1,
    endBrightness: 100,
    startColorTemp: 2000,
    endColorTemp: 4000,
    duration: 30 * 60 * 1000,
    startBeforeAlarm: 30 * 60 * 1000,
  },
};

export interface WakeUpLightConfig {
  enabled: boolean;
  startBrightness: number;
  endBrightness: number;
  startColorTemp: number;
  endColorTemp: number;
  duration: number;
  startBeforeAlarm: number;
}

export interface LightScene {
  id: string;
  name: string;
  devices: Map<string, LightState>;
  transitionTime: number;
}

export type DiscoveryProtocol = 'mdns' | 'upnp' | 'ble' | 'matter' | 'lan';

export interface DiscoveredDevice {
  id: string;
  name: string;
  type: LightDevice['type'];
  address: string;
  port?: number;
  protocol: DiscoveryProtocol;
  model?: string;
  firmware?: string;
}