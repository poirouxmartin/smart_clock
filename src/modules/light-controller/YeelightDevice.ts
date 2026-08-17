import { BaseLightDevice, DiscoveryService } from './BaseLightDevice';
import { LightDevice, LightState, LightCapabilities, DiscoveredDevice } from './types';

interface YeelightProperties {
  power: 'on' | 'off';
  bright: string;
  ct: string;
  rgb: string;
  hue: string;
  sat: string;
  name: string;
  model: string;
  fw_ver: string;
  support: string;
}

export class YeelightDevice extends BaseLightDevice {
  private socket: any = null;
  private messageId = 1;
  private pendingCommands: Map<number, (result: any) => void> = new Map();
  private host: string;
  private port: number;

  constructor(device: LightDevice) {
    super(device);
    this.host = device.address;
    this.port = device.port || 55443;
  }

  async connect(): Promise<boolean> {
    try {
      const { Socket } = require('react-native-tcp-socket');
      
      return new Promise((resolve) => {
        this.socket = Socket.createConnection({ host: this.host, port: this.port }, () => {
          this.setupListeners();
          this.getProps().then(() => {
            this.updateConnectionStatus(true);
            this.startPolling(5000);
            resolve(true);
          }).catch(() => resolve(false));
        });

        this.socket.on('error', () => {
          this.updateConnectionStatus(false);
          resolve(false);
        });

        this.socket.on('close', () => {
          this.updateConnectionStatus(false);
        });
      });
    } catch (error) {
      console.error('[Yeelight] Connection failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.updateConnectionStatus(false);
  }

  private setupListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('data', (data: Buffer) => {
      try {
        const messages = data.toString().trim().split('\r\n');
        for (const msg of messages) {
          if (msg) {
            const parsed = JSON.parse(msg);
            this.handleResponse(parsed);
          }
        }
      } catch {}
    });
  }

  private handleResponse(response: any): void {
    if (response.id && this.pendingCommands.has(response.id)) {
      const resolve = this.pendingCommands.get(response.id)!;
      this.pendingCommands.delete(response.id);
      resolve(response.result);
    }
    
    if (response.method === 'props') {
      this.updateStateFromProps(response.params);
    }
  }

  private sendCommand(method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'));
      
      const id = this.messageId++;
      this.pendingCommands.set(id, resolve);
      
      const command = JSON.stringify({ id, method, params }) + '\r\n';
      this.socket.write(command);
      
      setTimeout(() => {
        if (this.pendingCommands.has(id)) {
          this.pendingCommands.delete(id);
          reject(new Error('Command timeout'));
        }
      }, 5000);
    });
  }

  async getProps(properties?: string[]): Promise<YeelightProperties | null> {
    const props = properties || [
      'power', 'bright', 'ct', 'rgb', 'hue', 'sat', 'name', 'model', 'fw_ver', 'support'
    ];
    const result = await this.sendCommand('get_prop', props);
    if (result && Array.isArray(result)) {
      return {
        power: result[0],
        bright: result[1],
        ct: result[2],
        rgb: result[3],
        hue: result[4],
        sat: result[5],
        name: result[6],
        model: result[7],
        fw_ver: result[8],
        support: result[9],
      };
    }
    return null;
  }

  private updateStateFromProps(props: string[]): void {
    const state: LightState = {
      on: props[0] === 'on',
      brightness: Math.round(parseInt(props[1]) / 100 * 100),
      colorTemperature: parseInt(props[2]) > 0 ? parseInt(props[2]) : undefined,
      transitionTime: 1000,
    };
    this.notifyStateChange(state);
  }

  async setState(state: Partial<LightState>): Promise<boolean> {
    const commands: Array<[string, any[]]> = [];
    const duration = Math.round((state.transitionTime || 1000) / 1000 * 1000);

    if (state.on !== undefined) {
      commands.push(['set_power', [state.on ? 'on' : 'off', 'smooth', duration]]);
    }
    if (state.brightness !== undefined) {
      commands.push(['set_bright', [Math.max(1, Math.min(100, state.brightness)), 'smooth', duration]]);
    }
    if (state.colorTemperature !== undefined) {
      commands.push(['set_ct_abx', [state.colorTemperature, 'smooth', duration]]);
    }
    if (state.color !== undefined) {
      const { r, g, b } = state.color;
      const rgb = (r << 16) | (g << 8) | b;
      commands.push(['set_rgb', [rgb, 'smooth', duration]]);
    }

    try {
      for (const [method, params] of commands) {
        await this.sendCommand(method, params);
      }
      return true;
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
    return this.setState({ colorTemperature: Math.max(1700, Math.min(6500, temp)), transitionTime });
  }

  async setColor(r: number, g: number, b: number, transitionTime = 1000): Promise<boolean> {
    return this.setState({ color: { r, g, b }, transitionTime });
  }

  protected async fetchState(): Promise<void> {
    await this.getProps();
  }
}

export class YeelightDiscoveryService extends DiscoveryService {
  private listeners: Set<(device: DiscoveredDevice) => void> = new Set();
  private abortController: AbortController | null = null;

  async startDiscovery(timeout: number): Promise<DiscoveredDevice[]> {
    this.abortController = new AbortController();
    const devices: DiscoveredDevice[] = [];

    try {
      const { Socket } = require('react-native-tcp-socket');
      const { MulticastSocket } = require('react-native-udp');
      
      const socket = new MulticastSocket();
      socket.bind(1982);
      socket.joinGroup('239.255.255.250');
      
      const message = 
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1982\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'ST: wifi_bulb\r\n' +
        'MX: 2\r\n\r\n';
      
      socket.send(message, 0, message.length, 1982, '239.255.255.250');
      
      socket.on('message', (msg: Buffer, rinfo: any) => {
        const response = msg.toString();
        if (response.includes('wifi_bulb')) {
          const location = response.match(/LOCATION: yeelight:\/\/(.+):(\d+)/i);
          if (location) {
            devices.push({
              id: `yeelight_${location[1]}_${location[2]}`,
              name: 'Yeelight',
              type: 'yeelight',
              address: location[1],
              port: parseInt(location[2]),
              protocol: 'lan',
            });
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, timeout));
      socket.close();
    } catch (error) {
      console.warn('[YeelightDiscovery] Failed:', error);
    }
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

export function createYeelightDevice(device: LightDevice): YeelightDevice {
  return new YeelightDevice(device);
}