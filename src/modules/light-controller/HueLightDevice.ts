import { BaseLightDevice, DiscoveryService } from './BaseLightDevice';
import { LightDevice, LightState, LightCapabilities, DiscoveredDevice } from './types';

interface HueBridge {
  ip: string;
  username: string;
  lights: Map<string, HueLight>;
}

interface HueLight {
  id: string;
  name: string;
  state: {
    on: boolean;
    bri: number;
    ct?: number;
    xy?: number[];
    alert?: string;
    effect?: string;
    reachable: boolean;
  };
  type: string;
  modelid: string;
  swversion: string;
}

export class HueLightDevice extends BaseLightDevice {
  private bridge: HueBridge | null = null;
  private lightId: string;

  constructor(device: LightDevice) {
    super(device);
    this.lightId = device.address;
  }

  async connect(): Promise<boolean> {
    try {
      const bridgeIp = await this.discoverBridge();
      if (!bridgeIp) return false;

      const username = await this.getOrCreateUsername(bridgeIp);
      if (!username) return false;

      this.bridge = {
        ip: bridgeIp,
        username,
        lights: new Map(),
      };

      await this.fetchLights();
      this.updateConnectionStatus(true);
      this.startPolling(5000);
      return true;
    } catch (error) {
      console.error('[HueLight] Connection failed:', error);
      this.updateConnectionStatus(false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.bridge = null;
    this.updateConnectionStatus(false);
  }

  async setState(state: Partial<LightState>): Promise<boolean> {
    if (!this.bridge) return false;

    const hueState: Record<string, any> = { transitiontime: Math.round((state.transitionTime || 1000) / 100) };
    
    if (state.on !== undefined) hueState.on = state.on;
    if (state.brightness !== undefined) hueState.bri = Math.round(state.brightness * 2.54);
    if (state.colorTemperature !== undefined) hueState.ct = Math.round(1000000 / state.colorTemperature);
    if (state.color !== undefined) {
      const { r, g, b } = state.color;
      hueState.xy = this.rgbToXy(r, g, b);
    }

    try {
      const response = await fetch(`http://${this.bridge.ip}/api/${this.bridge.username}/lights/${this.lightId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hueState),
      });
      const result = await response.json();
      return Array.isArray(result) && result[0].success;
    } catch {
      return false;
    }
  }

  async turnOn(transitionTime = 1000): Promise<boolean> {
    return this.setState({ on: true, transitionTime });
  }

  async turnOff(transitionTime = 1000): Promise<boolean> {
    return this.setState({ on: false, transitionTime });
  }

  async setBrightness(brightness: number, transitionTime = 1000): Promise<boolean> {
    return this.setState({ brightness: Math.max(1, Math.min(100, brightness)), transitionTime });
  }

  async setColorTemperature(temp: number, transitionTime = 1000): Promise<boolean> {
    const capped = Math.max(153, Math.min(500, Math.round(1000000 / temp)));
    return this.setState({ colorTemperature: Math.round(1000000 / capped), transitionTime });
  }

  async setColor(r: number, g: number, b: number, transitionTime = 1000): Promise<boolean> {
    return this.setState({ color: { r, g, b }, transitionTime });
  }

  protected async fetchState(): Promise<void> {
    if (!this.bridge) return;
    try {
      const response = await fetch(`http://${this.bridge.ip}/api/${this.bridge.username}/lights/${this.lightId}`);
      const light: HueLight = await response.json();
      this.bridge.lights.set(this.lightId, light);
      
      const state: LightState = {
        on: light.state.on,
        brightness: Math.round(light.state.bri / 2.54),
        colorTemperature: light.state.ct ? Math.round(1000000 / light.state.ct) : undefined,
        transitionTime: 1000,
      };
      this.notifyStateChange(state);
    } catch {}
  }

  private async discoverBridge(): Promise<string | null> {
    try {
      const response = await fetch('https://discovery.meethue.com/');
      const bridges = await response.json();
      return bridges[0]?.internalipaddress || null;
    } catch {
      return null;
    }
  }

  private async getOrCreateUsername(ip: string): Promise<string | null> {
    try {
      const stored = await this.getStoredUsername(ip);
      if (stored) return stored;

      const response = await fetch(`http://${ip}/api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devicetype: 'smart_clock#android' }),
      });
      const result = await response.json();
      if (result[0]?.success?.username) {
        await this.storeUsername(ip, result[0].success.username);
        return result[0].success.username;
      }
    } catch {}
    return null;
  }

  private async getStoredUsername(ip: string): Promise<string | null> {
    return null;
  }

  private async storeUsername(ip: string, username: string): Promise<void> {}

  private async fetchLights(): Promise<void> {
    if (!this.bridge) return;
    const response = await fetch(`http://${this.bridge.ip}/api/${this.bridge.username}/lights`);
    const lights = await response.json();
    Object.entries(lights).forEach(([id, light]: [string, any]) => {
      this.bridge!.lights.set(id, { ...light, id });
    });
  }

  private rgbToXy(r: number, g: number, b: number): [number, number] {
    r = r / 255; g = g / 255; b = b / 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
    const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
    const Z = r * 0.000088 + g * 0.072310 + b * 0.986039;
    const sum = X + Y + Z;
    
    return sum > 0 ? [X / sum, Y / sum] : [0.3127, 0.3290];
  }
}

export class HueDiscoveryService extends DiscoveryService {
  private listeners: Set<(device: DiscoveredDevice) => void> = new Set();
  private abortController: AbortController | null = null;

  async startDiscovery(timeout: number): Promise<DiscoveredDevice[]> {
    this.abortController = new AbortController();
    const devices: DiscoveredDevice[] = [];

    try {
      const response = await fetch('https://discovery.meethue.com/', { signal: this.abortController.signal });
      const bridges = await response.json();
      
      for (const bridge of bridges) {
        const bridgeDevices = await this.discoverBridgeLights(bridge.internalipaddress);
        devices.push(...bridgeDevices);
      }
    } catch (error) {
      console.warn('[HueDiscovery] Failed:', error);
    }
    return devices;
  }

  private async discoverBridgeLights(ip: string): Promise<DiscoveredDevice[]> {
    const devices: DiscoveredDevice[] = [];
    try {
      const response = await fetch(`http://${ip}/api/newdeveloper/lights`);
      const lights = await response.json();
      
      Object.entries(lights).forEach(([id, light]: [string, any]) => {
        devices.push({
          id: `hue_${ip}_${id}`,
          name: light.name,
          type: 'hue',
          address: id,
          protocol: 'lan',
          model: light.modelid,
          firmware: light.swversion,
        });
      });
    } catch {}
    return devices;
  }

  stopDiscovery(): void {
    this.abortController?.abort();
  }

  onDeviceFound(callback: (device: DiscoveredDevice) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export function createHueDevice(device: LightDevice): HueLightDevice {
  return new HueLightDevice(device);
}