import { LightDevice, LightState, LightCapabilities, DiscoveredDevice } from './types';

export abstract class BaseLightDevice {
  protected device: LightDevice;
  protected listeners: Set<(state: LightState) => void> = new Set();
  protected pollingInterval: NodeJS.Timeout | null = null;

  constructor(device: LightDevice) {
    this.device = device;
  }

  getId(): string {
    return this.device.id;
  }

  getName(): string {
    return this.device.name;
  }

  getType(): LightDevice['type'] {
    return this.device.type;
  }

  getCapabilities(): LightCapabilities {
    return this.device.capabilities;
  }

  isConnected(): boolean {
    return this.device.isConnected;
  }

  getState(): LightState {
    return {
      on: false,
      brightness: 0,
      transitionTime: 1000,
    };
  }

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract setState(state: Partial<LightState>): Promise<boolean>;
  abstract turnOn(transitionTime?: number): Promise<boolean>;
  abstract turnOff(transitionTime?: number): Promise<boolean>;
  abstract setBrightness(brightness: number, transitionTime?: number): Promise<boolean>;
  abstract setColorTemperature(temp: number, transitionTime?: number): Promise<boolean>;
  abstract setColor(r: number, g: number, b: number, transitionTime?: number): Promise<boolean>;

  addStateListener(callback: (state: LightState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  protected notifyStateChange(state: LightState): void {
    this.listeners.forEach(cb => cb(state));
  }

  protected updateConnectionStatus(connected: boolean): void {
    this.device.isConnected = connected;
    this.device.lastSeen = Date.now();
  }

  startPolling(intervalMs: number = 5000): void {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => {
      this.fetchState().catch(() => {});
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  protected abstract fetchState(): Promise<void>;

  async executeWakeUpLight(config: {
    startBrightness: number;
    endBrightness: number;
    startColorTemp: number;
    endColorTemp: number;
    duration: number;
  }): Promise<void> {
    await this.turnOn(1000);
    await this.setColorTemperature(config.startColorTemp, 1000);
    await this.setBrightness(config.startBrightness, 1000);

    const steps = 60;
    const stepDuration = config.duration / steps;
    const brightnessStep = (config.endBrightness - config.startBrightness) / steps;
    const tempStep = (config.endColorTemp - config.startColorTemp) / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      if (!this.device.isConnected) break;
      
      const brightness = Math.round(config.startBrightness + brightnessStep * i);
      const colorTemp = Math.round(config.startColorTemp + tempStep * i);
      
      await this.setBrightness(brightness, stepDuration * 2);
      await this.setColorTemperature(colorTemp, stepDuration * 2);
    }
  }
}

export abstract class DiscoveryService {
  abstract startDiscovery(timeout: number): Promise<DiscoveredDevice[]>;
  abstract stopDiscovery(): void;
  abstract onDeviceFound(callback: (device: DiscoveredDevice) => void): () => void;
}