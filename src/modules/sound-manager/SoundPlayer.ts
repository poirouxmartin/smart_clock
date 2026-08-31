import { Audio, AudioPlayer } from 'expo-audio';
import { SoundAsset, PlaybackConfig, PlaybackState, PlaybackStatus, SoundManagerConfig, DEFAULT_SOUND_CONFIG } from './types';

type StatusCallback = (status: PlaybackStatus) => void;

export class SoundPlayer {
  private player: AudioPlayer | null = null;
  private currentConfig: PlaybackConfig | null = null;
  private config: SoundManagerConfig;
  private state: PlaybackState = 'idle';
  private statusCallback: StatusCallback | null = null;
  private fadeInterval: NodeJS.Timeout | null = null;
  private positionInterval: NodeJS.Timeout | null = null;
  private targetVolume = 0;
  private isMounted = true;
  private playerListener: { remove: () => void } | null = null;

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
    if (this.player) {
      await this.unload();
    }

    this.state = 'loading';
    this.emitStatus();

    try {
      this.player = Audio.createAudioPlayer(
        { uri: asset.uri },
        { downloadFirst: false }
      );

      this.playerListener = this.player.addListener('playbackStatusUpdate', (status) => {
        this.onPlaybackStatusUpdate(status);
      });

      this.state = 'idle';
      this.emitStatus({ duration: asset.duration });
    } catch (error) {
      this.state = 'error';
      this.emitStatus({ error: error instanceof Error ? error.message : 'Erreur chargement son' });
      throw error;
    }
  }

  private onPlaybackStatusUpdate(status: any): void {
    if (!this.isMounted || !this.currentConfig) return;

    if (status.isLoaded) {
      const newState: PlaybackState = status.playing ? 'playing' : 
        status.isBuffering ? 'loading' : 'paused';
      
      if (newState !== this.state) {
        this.state = newState;
      }

      this.emitStatus({
        position: (status.currentTime || 0) * 1000,
        duration: (status.duration || 0) * 1000,
        volume: status.volume ?? this.targetVolume,
        isLooping: this.player?.loop ?? false,
      });
    } else if (status.error) {
      this.state = 'error';
      this.emitStatus({ error: status.error });
    }
  }

  async play(config: PlaybackConfig): Promise<void> {
    if (!this.player) {
      throw new Error('Aucun son chargé');
    }

    this.currentConfig = { ...config };
    this.targetVolume = Math.min(config.volume, this.config.maxVolume);
    
    this.player.loop = config.loop;
    await this.player.seekTo((config.startTime || 0) / 1000);
    
    this.state = 'fading_in';
    this.emitStatus();

    this.player.volume = 0;
    this.player.play();
    
    this.startFadeIn(this.config.fadeInDuration);
    this.startPositionTracking();
  }

  private startFadeIn(duration: number): void {
    const steps = 60;
    const stepDuration = duration / steps;
    const volumeStep = this.targetVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.isMounted || !this.player || currentStep >= steps) {
        this.stopFadeInterval();
        if (this.isMounted && this.player) {
          this.player.volume = this.targetVolume;
          this.state = 'playing';
          this.emitStatus();
        }
        return;
      }

      currentStep++;
      const newVolume = Math.min(volumeStep * currentStep, this.targetVolume);
      this.player!.volume = newVolume;
    }, stepDuration);
  }

  private startFadeOut(duration: number): void {
    if (!this.player) return;

    this.state = 'fading_out';
    this.emitStatus();

    const startVolume = this.currentConfig?.volume || this.config.defaultVolume;
    const steps = 30;
    const stepDuration = duration / steps;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.isMounted || !this.player || currentStep >= steps) {
        this.stopFadeInterval();
        this.stop();
        return;
      }

      currentStep++;
      const newVolume = Math.max(startVolume - volumeStep * currentStep, 0);
      this.player!.volume = newVolume;
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
      if (this.player && this.isMounted) {
        this.emitStatus({
          position: (this.player.currentTime || 0) * 1000,
          duration: (this.player.duration || 0) * 1000,
        });
      }
    }, 500);
  }

  private stopPositionTracking(): void {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }

  pause(): void {
    if (!this.player) return;
    this.player.pause();
    this.state = 'paused';
    this.emitStatus();
  }

  resume(): void {
    if (!this.player) return;
    this.player.play();
    this.state = 'playing';
    this.emitStatus();
  }

  async stop(fadeOut = true): Promise<void> {
    if (!this.player) return;

    this.stopPositionTracking();

    if (fadeOut && this.state === 'playing') {
      this.startFadeOut(this.config.fadeOutDuration);
      return;
    }

    this.player.pause();
    this.unload();
  }

  private unload(): void {
    this.stopFadeInterval();
    this.stopPositionTracking();
    
    if (this.playerListener) {
      this.playerListener.remove();
      this.playerListener = null;
    }

    if (this.player) {
      try {
        this.player.remove();
      } catch {}
      this.player = null;
    }
    
    this.currentConfig = null;
    this.state = 'idle';
    this.emitStatus();
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.player) return;
    const clamped = Math.max(0, Math.min(volume, this.config.maxVolume));
    this.targetVolume = clamped;
    this.player.volume = clamped;
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
    if (this.playerListener) {
      this.playerListener.remove();
      this.playerListener = null;
    }
    if (this.player) {
      this.player.remove();
      this.player = null;
    }
  }
}

export function createSoundPlayer(config?: Partial<SoundManagerConfig>): SoundPlayer {
  return new SoundPlayer(config);
}
