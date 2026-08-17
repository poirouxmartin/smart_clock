import { LightController } from './LightController';
import { LightDevice, LightState, LightControllerConfig, DEFAULT_LIGHT_CONFIG, WakeUpLightConfig, DiscoveredDevice, LightScene } from './types';
import { HueLightDevice, HueDiscoveryService } from './HueLightDevice';
import { YeelightDevice, YeelightDiscoveryService } from './YeelightDevice';
import { MatterLightDevice, MatterDiscoveryService } from './MatterLightDevice';
import { BaseLightDevice, DiscoveryService } from './BaseLightDevice';

export class LightController {
  private devices: Map<string, BaseLightDevice> = new Map();
  private config: LightControllerConfig;
  private discoveryServices: Map<string, DiscoveryService> = new Map();
  private wakeUpLightTimeout: NodeJS.Timeout | null = null;
  private stateListeners: Set<(deviceId: string, state: LightState) => void> = new Set();
  private deviceListeners: Set<(devices: LightDevice[]) => void> = new Set();
  private initialized = false;

  constructor(config: Partial<LightControllerConfig> = {}) {
    this.config = { ...DEFAULT_LIGHT_CONFIG, ...config };
    this.registerDiscoveryServices();
  }

  private registerDiscoveryServices(): void {
    this.discoveryServices.set('hue', new HueDiscoveryService());
    this.discoveryServices.set('yeelight', new YeelightDiscoveryService());
    this.discoveryServices.set('matter', new MatterDiscoveryService());
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.config.autoDiscover) {
      await this.discoverDevices();
    }
    
    this.initialized = true;
  }

  async discoverDevices(timeout?: number): Promise<LightDevice[]> {
    const discovered: LightDevice[] = [];
    
    for (const [type, service] of this.discoveryServices) {
      try {
        const devices = await service.startDiscovery(timeout || this.config.discoveryTimeout);
        for (const d of devices) {
          const device = this.createLightDevice(d);
          if (device) {
            const connected = await device.connect();
            if (connected) {
              this.addDevice(device.getDevice());
              discovered.push(device.getDevice());
            }
          }
        }
        service.stopDiscovery();
      } catch (error) {
        console.warn(`[LightController] Discovery failed for ${type}:`, error);
      }
    }
    
    this.notifyDeviceListChange();
    return discovered;
  }

  private createLightDevice(discovered: DiscoveredDevice): BaseLightDevice | null {
    const device: LightDevice = {
      id: discovered.id,
      name: discovered.name,
      type: discovered.type,
      address: discovered.address,
      port: discovered.port,
      capabilities: this.getDefaultCapabilities(discovered.type),
      isConnected: false,
      lastSeen: Date.now(),
    };

    switch (discovered.type) {
      case 'hue':
        return new HueLightDevice(device);
      case 'yeelight':
        return new YeelightDevice(device);
      case 'matter':
        return new MatterLightDevice(device);
      default:
        return null;
    }
  }

  private getDefaultCapabilities(type: LightDevice['type']): LightCapabilities {
    const base: LightCapabilities = {
      brightness: true,
      colorTemperature: true,
      color: false,
      effects: false,
      minBrightness: 1,
      maxBrightness: 100,
      minColorTemp: 153,
      maxColorTemp: 500,
    };

    switch (type) {
      case 'hue':
        return { ...base, color: true, effects: true, maxColorTemp: 500, minColorTemp: 153 };
      case 'yeelight':
        return { ...base, color: true, effects: true, maxColorTemp: 6500, minColorTemp: 1700 };
      case 'matter':
        return { ...base, color: true, effects: false, maxColorTemp: 6500, minColorTemp: 153 };
      default:
        return base;
    }
  }

  addDevice(device: LightDevice): void {
    const existing = this.devices.get(device.id);
    if (existing) {
      existing.updateConnectionStatus(device.isConnected);
    } else {
      const lightDevice = this.createLightDevice({
        id: device.id,
        name: device.name,
        type: device.type,
        address: device.address,
        port: device.port,
        protocol: 'lan',
      });
      if (lightDevice) {
        lightDevice.addStateListener((state) => this.notifyStateChange(device.id, state));
        this.devices.set(device.id, lightDevice);
      }
    }
    this.notifyDeviceListChange();
  }

  removeDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.disconnect();
      this.devices.delete(deviceId);
      this.notifyDeviceListChange();
    }
  }

  getDevice(deviceId: string): LightDevice | undefined {
    const device = this.devices.get(deviceId);
    return device?.getDevice?.() || device?.device;
  }

  getAllDevices(): LightDevice[] {
    return Array.from(this.devices.values()).map(d => d.getDevice?.() || d.device).filter(Boolean) as LightDevice[];
  }

  getConnectedDevices(): LightDevice[] {
    return this.getAllDevices().filter(d => d.isConnected);
  }

  async setDeviceState(deviceId: string, state: Partial<LightState>): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    return device.setState(state);
  }

  async turnOn(deviceId: string, transitionTime?: number): Promise<boolean> {
    return this.setDeviceState(deviceId, { on: true, transitionTime });
  }

  async turnOff(deviceId: string, transitionTime?: number): Promise<boolean> {
    return this.setDeviceState(deviceId, { on: false, transitionTime });
  }

  async setBrightness(deviceId: string, brightness: number, transitionTime?: number): Promise<boolean> {
    return this.setDeviceState(deviceId, { brightness, transitionTime });
  }

  async setColorTemperature(deviceId: string, temp: number, transitionTime?: number): Promise<boolean> {
    return this.setDeviceState(deviceId, { colorTemperature: temp, transitionTime });
  }

  async setColor(deviceId: string, r: number, g: number, b: number, transitionTime?: number): Promise<boolean> {
    return this.setDeviceState(deviceId, { color: { r, g, b }, transitionTime });
  }

  async executeWakeUpLight(deviceIds: string[], config?: Partial<WakeUpLightConfig>): Promise<void> {
    const wakeConfig = { ...this.config.wakeUpLightConfig, ...config };
    if (!wakeConfig.enabled) return;

    if (this.wakeUpLightTimeout) {
      clearTimeout(this.wakeUpLightTimeout);
    }

    const startTime = Date.now() + wakeConfig.startBeforeAlarm;
    const delay = Math.max(0, startTime - Date.now());

    this.wakeUpLightTimeout = setTimeout(async () => {
      await Promise.all(
        deviceIds.map(id => this.devices.get(id)?.executeWakeUpLight(wakeConfig))
      );
    }, delay);
  }

  cancelWakeUpLight(): void {
    if (this.wakeUpLightTimeout) {
      clearTimeout(this.wakeUpLightTimeout);
      this.wakeUpLightTimeout = null;
    }
  }

  async applyScene(scene: LightScene): Promise<void> {
    await Promise.all(
      Array.from(scene.devices.entries()).map(([id, state]) =>
        this.setDeviceState(id, { ...state, transitionTime: scene.transitionTime })
      )
    );
  }

  createScene(id: string, name: string, transitionTime: number = 1000): LightScene {
    const devices = new Map<string, LightState>();
    for (const [id, device] of this.devices) {
      devices.set(id, device.getState?.() || { on: false, brightness: 0 });
    }
    return { id, name, devices, transitionTime };
  }

  onStateChange(callback: (deviceId: string, state: LightState) => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onDeviceListChange(callback: (devices: LightDevice[]) => void): () => void {
    this.deviceListeners.add(callback);
    return () => this.deviceListeners.delete(callback);
  }

  private notifyStateChange(deviceId: string, state: LightState): void {
    this.stateListeners.forEach(cb => cb(deviceId, state));
  }

  private notifyDeviceListChange(): void {
    this.deviceListeners.forEach(cb => cb(this.getAllDevices()));
  }

  updateConfig(config: Partial<LightControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LightControllerConfig {
    return { ...this.config };
  }

  async shutdown(): Promise<void> {
    this.cancelWakeUpLight();
    for (const device of this.devices.values()) {
      await device.disconnect();
    }
    this.devices.clear();
    for (const service of this.discoveryServices.values()) {
      service.stopDiscovery();
    }
    this.initialized = false;
  }
}

let lightControllerInstance: LightController | null = null;

export function getLightController(config?: Partial<LightControllerConfig>): LightController {
  if (!lightControllerInstance) {
    lightControllerInstance = new LightController(config);
  }
  return lightControllerInstance;
}

export function createLightController(config?: Partial<LightControllerConfig>): LightController {
  return new LightController(config);
}