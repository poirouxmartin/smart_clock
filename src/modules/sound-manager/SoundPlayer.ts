import { Audio, AudioSound } from 'expo-av';
import { SoundAsset, PlaybackConfig, PlaybackState, PlaybackStatus, SoundManagerConfig, DEFAULT_SOUND_CONFIG } from './types';

type StatusCallback = (status: PlaybackStatus) => void;

export class SoundPlayer {
  private sound: AudioSound | null = null;
  private currentConfig: PlaybackConfig | null = null;
  private config: SoundManagerConfig;
  private state: PlaybackState = 'idle';
  private statusCallback: StatusCallback | null = null;
  private fadeInterval: NodeJS.Timeout | null = null;
  private positionInterval: NodeJS.Timeout | null = null;
  private targetVolume = 0;
  private isMounted = true;

  constructor(config: Partial<SoundManagerConfig> = {}) {
    this.config = { ...DEFAULT_SOUND_CONFIG, ...config };
  }

  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  private emitStatus(overrides: Partial<PlaybackStatus> = {}): void {
    if (!this.statusCallback || !this.isMounted) return;
    
    this.statusCallback({
      state: this.state,
      soundId: this.currentConfig?.soundId || null,
      position: 0,
      duration: 0,
      volume: this.currentConfig?.volume || this.config.defaultVolume,
      isLooping: this.currentConfig?.loop || false,
      ...overrides,
    });
  }

  async loadSound(asset: SoundAsset): Promise<void> {
    if (this.sound) {
      await this.unload();
    }

    this.state = 'loading';
    this.emitStatus();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: asset.uri },
        { shouldPlay: false, isLooping: asset.loopable, volume: 0 },
        this.onPlaybackStatusUpdate.bind(this)
      );
      
      this.sound = sound;
      this.state = 'idle';
      this.emitStatus({ duration: asset.duration });
    } catch (error) {
      this.state = 'error';
      this.emitStatus({ error: error instanceof Error ? error.message : 'Erreur chargement son' });
      throw error;
    }
  }

  private onPlaybackStatusUpdate(status: Audio.AudioStatus): void {
    if (!this.isMounted || !this.currentConfig) return;

    if (status.isLoaded) {
      const newState: PlaybackState = status.isPlaying ? 'playing' : 
        status.isBuffering ? 'loading' : 'paused';
      
      if (newState !== this.state) {
        this.state = newState;
      }

      this.emitStatus({
        position: status.positionMillis,
        duration: status.durationMillis,
        volume: status.volume,
        isLooping: status.isLooping,
      });
    } else if (status.error) {
      this.state = 'error';
      this.emitStatus({ error: status.error });
    }
  }

  async play(config: PlaybackConfig): Promise<void> {
    if (!this.sound) {
      throw new Error('Aucun son chargé');
    }

    this.currentConfig = { ...config };
    this.targetVolume = Math.min(config.volume, this.config.maxVolume);
    
    await this.sound.setLoopingAsync(config.loop);
    await this.sound.setPositionAsync(config.startTime || 0);
    
    this.state = 'fading_in';
    this.emitStatus();

    await this.sound.setVolumeAsync(0);
    await this.sound.playAsync();
    
    this.startFadeIn(this.config.fadeInDuration);
    this.startPositionTracking();
  }

  private startFadeIn(duration: number): void {
    const steps = 60;
    const stepDuration = duration / steps;
    const volumeStep = this.targetVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(async () => {
      if (!this.isMounted || !this.sound || currentStep >= steps) {
        this.stopFadeInterval();
        if (this.isMounted && this.sound) {
          await this.sound.setVolumeAsync(this.targetVolume);
          this.state = 'playing';
          this.emitStatus();
        }
        return;
      }

      currentStep++;
      const newVolume = Math.min(volumeStep * currentStep, this.targetVolume);
      await this.sound.setVolumeAsync(newVolume);
    }, stepDuration);
  }

  private startFadeOut(duration: number): void {
    if (!this.sound) return;

    this.state = 'fading_out';
    this.emitStatus();

    const startVolume = this.currentConfig?.volume || this.config.defaultVolume;
    const steps = 30;
    const stepDuration = duration / steps;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(async () => {
      if (!this.isMounted || !this.sound || currentStep >= steps) {
        this.stopFadeInterval();
        await this.stop();
        return;
      }

      currentStep++;
      const newVolume = Math.max(startVolume - volumeStep * currentStep, 0);
      await this.sound.setVolumeAsync(newVolume);
    }, stepDuration);
  }

  private stopFadeInterval(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  private startPositionTracking(): void {
    this.positionInterval = setInterval(() => {
      if (this.sound && this.isMounted) {
        this.sound.getStatusAsync().then(status => {
          if (status.isLoaded && this.isMounted) {
            this.emitStatus({
              position: status.positionMillis,
              duration: status.durationMillis,
            });
          }
        }).catch(() => {});
      }
    }, 500);
  }

  private stopPositionTracking(): void {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }

  async pause(): Promise<void> {
    if (!this.sound) return;
    await this.sound.pauseAsync();
    this.state = 'paused';
    this.emitStatus();
  }

  async resume(): Promise<void> {
    if (!this.sound) return;
    await this.sound.playAsync();
    this.state = 'playing';
    this.emitStatus();
  }

  async stop(fadeOut = true): Promise<void> {
    if (!this.sound) return;

    this.stopPositionTracking();

    if (fadeOut && this.state === 'playing') {
      await this.startFadeOut(this.config.fadeOutDuration);
      return;
    }

    await this.sound.stopAsync();
    await this.unload();
  }

  private async unload(): Promise<void> {
    this.stopFadeInterval();
    this.stopPositionTracking();
    
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch {}
      this.sound = null;
    }
    
    this.currentConfig = null;
    this.state = 'idle';
    this.emitStatus();
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.sound) return;
    const clamped = Math.max(0, Math.min(volume, this.config.maxVolume));
    this.targetVolume = clamped;
    await this.sound.setVolumeAsync(clamped);
    this.emitStatus({ volume: clamped });
  }

  getState(): PlaybackState {
    return this.state;
  }

  getCurrentSoundId(): string | null {
    return this.currentConfig?.soundId || null;
  }

  isPlaying(): boolean {
    return this.state === 'playing' || this.state === 'fading_in';
  }

  destroy(): void {
    this.isMounted = false;
    this.stopFadeInterval();
    this.stopPositionTracking();
    if (this.sound) {
      this.sound.unloadAsync().catch(() => {});
      this.sound = null;
    }
  }
}

export function createSoundPlayer(config?: Partial<SoundManagerConfig>): SoundPlayer {
  return new SoundPlayer(config);
}