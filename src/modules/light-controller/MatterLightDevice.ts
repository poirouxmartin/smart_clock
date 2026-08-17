import { BaseLightDevice, DiscoveryService } from './BaseLightDevice';
import { LightDevice, LightState, LightCapabilities, DiscoveredDevice } from './types';

interface MatterDevice {
  nodeId: number;
  fabricIndex: number;
  endpoints: Map<number, MatterEndpoint>;
  isCommissioned: boolean;
}

interface MatterEndpoint {
  endpointId: number;
  deviceType: number;
  clusters: Map<number, MatterCluster>;
}

interface MatterCluster {
  clusterId: number;
  attributes: Map<string, any>;
  commands: Map<string, any>;
}

export class MatterLightDevice extends BaseLightDevice {
  private device: MatterDevice | null = null;
  private controller: any = null;
  private endpointId: number = 1;

  constructor(device: LightDevice) {
    super(device);
  }

  async connect(): Promise<boolean> {
    try {
      const { MatterController } = await import('react-native-matter');
      
      this.controller = new MatterController();
      await this.controller.init();
      
      const nodeId = parseInt(this.device.address);
      const commissioned = await this.controller.isCommissioned(nodeId);
      
      if (!commissioned) {
        const qrCode = await this.getStoredQRCode();
        if (qrCode) {
          await this.controller.commission(qrCode);
        } else {
          console.warn('[MatterLight] Device not commissioned');
          return false;
        }
      }

      this.device = await this.controller.getDevice(nodeId);
      this.updateConnectionStatus(true);
      this.startPolling(5000);
      return true;
    } catch (error) {
      console.error('[MatterLight] Connection failed:', error);
      this.updateConnectionStatus(false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.device = null;
    this.updateConnectionStatus(false);
  }

  async setState(state: Partial<LightState>): Promise<boolean> {
    if (!this.device || !this.controller) return false;

    try {
      const commands: any[] = [];
      
      if (state.on !== undefined) {
        commands.push({
          cluster: 0x0006,
          command: state.on ? 0x0001 : 0x0000,
        });
      }
      if (state.brightness !== undefined) {
        commands.push({
          cluster: 0x0008,
          command: 0x0000,
          args: { level: Math.round(state.brightness * 2.54) },
        });
      }
      if (state.colorTemperature !== undefined) {
        commands.push({
          cluster: 0x0300,
          command: 0x0000,
          args: { colorTemperature: Math.round(1000000 / state.colorTemperature) },
        });
      }
      if (state.color !== undefined) {
        commands.push({
          cluster: 0x0300,
          command: 0x0000,
          args: { colorX: 0, colorY: 0 },
        });
      }

      for (const cmd of commands) {
        await this.controller.sendCommand(
          this.device!.nodeId,
          this.endpointId,
          cmd.cluster,
          cmd.command,
          cmd.args
        );
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
    return this.setState({ colorTemperature: Math.max(153, Math.min(500, Math.round(1000000 / temp))), transitionTime });
  }

  async setColor(r: number, g: number, b: number, transitionTime = 1000): Promise<boolean> {
    return this.setState({ color: { r, g, b }, transitionTime });
  }

  protected async fetchState(): Promise<void> {
    if (!this.device || !this.controller) return;
    
    try {
      const onOff = await this.controller.readAttribute(this.device.nodeId, this.endpointId, 0x0006, 0x0000);
      const level = await this.controller.readAttribute(this.device.nodeId, this.endpointId, 0x0008, 0x0000);
      const ct = await this.controller.readAttribute(this.device.nodeId, this.endpointId, 0x0300, 0x0007);
      
      this.notifyStateChange({
        on: onOff === true,
        brightness: level ? Math.round(level / 2.54) : 0,
        colorTemperature: ct ? Math.round(1000000 / ct) : undefined,
        transitionTime: 1000,
      });
    } catch {}
  }

  private async getStoredQRCode(): Promise<string | null> {
    return null;
  }
}

export class MatterDiscoveryService extends DiscoveryService {
  private listeners: Set<(device: DiscoveredDevice) => void> = new Set();
  private abortController: AbortController | null = null;

  async startDiscovery(timeout: number): Promise<DiscoveredDevice[]> {
    this.abortController = new AbortController();
    const devices: DiscoveredDevice[] = [];

    try {
      const { MatterController } = await import('react-native-matter');
      const controller = new MatterController();
      await controller.init();
      
      const discovered = await controller.discoverDevices(timeout);
      
      for (const d of discovered) {
        if (d.deviceType === 0x0100) {
          devices.push({
            id: `matter_${d.nodeId}`,
            name: d.name || `Matter Light ${d.nodeId}`,
            type: 'matter',
            address: d.nodeId.toString(),
            protocol: 'matter',
            model: d.model,
            firmware: d.firmwareVersion,
          });
        }
      }
    } catch (error) {
      console.warn('[MatterDiscovery] Failed:', error);
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

export function createMatterDevice(device: LightDevice): MatterLightDevice {
  return new MatterLightDevice(device);
}