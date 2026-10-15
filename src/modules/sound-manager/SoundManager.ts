import { setAudioModeAsync, preload } from 'expo-audio';
import { SoundPlayer, createSoundPlayer } from './SoundPlayer';
import {
  SoundAsset,
  PlaybackConfig,
  PlaybackStatus,
  SoundManagerConfig,
  DEFAULT_SOUND_CONFIG,
  NATURE_SOUNDS,
  SoundCategory,
} from './types';

export class SoundManager {
  private player: SoundPlayer;
  private config: SoundManagerConfig;
  private soundAssets: Map<string, SoundAsset> = new Map();
  private statusCallback: ((status: PlaybackStatus) => void) | null = null;
  private initialized = false;

  constructor(config: Partial<SoundManagerConfig> = {}) {
    this.config = { ...DEFAULT_SOUND_CONFIG, ...config };
    this.player = createSoundPlayer(this.config);
    this.player.setStatusCallback((status) => this.statusCallback?.(status));
    
    this.registerNatureSounds();
  }

  private registerNatureSounds(): void {
    NATURE_SOUNDS.forEach(sound => {
      this.soundAssets.set(sound.id, {
        ...sound,
        uri: `https://assets.mixkit.co/active_storage/sfx/${sound.id}.mp3`,
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      this.initialized = true;
    } catch (error) {
      console.error('[SoundManager] Failed to initialize audio mode:', error);
    }
  }

  setStatusCallback(callback: (status: PlaybackStatus) => void): void {
    this.statusCallback = callback;
    this.player.setStatusCallback(callback);
  }

  addCustomSound(asset: SoundAsset): void {
    this.soundAssets.set(asset.id, asset);
  }

  removeCustomSound(soundId: string): boolean {
    const asset = this.soundAssets.get(soundId);
    if (asset?.type === 'custom') {
      return this.soundAssets.delete(soundId);
    }
    return false;
  }

  getSound(soundId: string): SoundAsset | undefined {
    return this.soundAssets.get(soundId);
  }

  getAllSounds(category?: SoundCategory): SoundAsset[] {
    const sounds = Array.from(this.soundAssets.values());
    if (!category || category === 'all') return sounds;
    return sounds.filter(s => s.type === category);
  }

  async play(soundId: string, options: Partial<PlaybackConfig> = {}): Promise<void> {
    const asset = this.soundAssets.get(soundId);
    if (!asset) {
      throw new Error(`Son non trouvé: ${soundId}`);
    }

    await this.player.loadSound(asset);
    
    const config: PlaybackConfig = {
      soundId,
      volume: options.volume ?? this.config.defaultVolume,
      fadeInDuration: options.fadeInDuration ?? this.config.fadeInDuration,
      fadeOutDuration: options.fadeOutDuration ?? this.config.fadeOutDuration,
      loop: options.loop ?? asset.loopable,
      startTime: options.startTime,
    };

    await this.player.play(config);
  }

  async playAlarm(soundId: string, volume: number, fadeInDuration: number): Promise<void> {
    return this.play(soundId, { volume, fadeInDuration, loop: true });
  }

  async pause(): Promise<void> {
    this.player.pause();
  }

  async resume(): Promise<void> {
    this.player.resume();
  }

  async stop(fadeOut = true): Promise<void> {
    await this.player.stop(fadeOut);
  }

  async setVolume(volume: number): Promise<void> {
    await this.player.setVolume(volume);
  }

  getPlaybackState(): ReturnType<SoundPlayer['getState']> {
    return this.player.getState();
  }

  getCurrentSoundId(): string | null {
    return this.player.getCurrentSoundId();
  }

  isPlaying(): boolean {
    return this.player.isPlaying();
  }

  updateConfig(config: Partial<SoundManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SoundManagerConfig {
    return { ...this.config };
  }

  async preloadSound(soundId: string): Promise<void> {
    const asset = this.soundAssets.get(soundId);
    if (!asset) return;

    try {
      await preload({ uri: asset.uri });
    } catch (error) {
      console.warn(`[SoundManager] Failed to preload ${soundId}:`, error);
    }
  }

  async preloadCategory(category: SoundCategory): Promise<void> {
    const sounds = this.getAllSounds(category);
    await Promise.all(sounds.map(s => this.preloadSound(s.id)));
  }

  destroy(): void {
    this.player.destroy();
    this.initialized = false;
  }
}

let soundManagerInstance: SoundManager | null = null;

export function getSoundManager(config?: Partial<SoundManagerConfig>): SoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager(config);
  }
  return soundManagerInstance;
}

export function createSoundManager(config?: Partial<SoundManagerConfig>): SoundManager {
  return new SoundManager(config);
}
