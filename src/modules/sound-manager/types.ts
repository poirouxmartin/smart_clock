export interface SoundAsset {
  id: string;
  name: string;
  uri: string;
  type: 'nature' | 'custom' | 'system';
  duration: number;
  loopable: boolean;
  volume: number;
}

export interface PlaybackConfig {
  soundId: string;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  loop: boolean;
  startTime?: number;
}

export interface SoundManagerConfig {
  defaultVolume: number;
  maxVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  preloadSounds: boolean;
  duckOthers: boolean;
  stayAwake: boolean;
}

export const DEFAULT_SOUND_CONFIG: SoundManagerConfig = {
  defaultVolume: 0.7,
  maxVolume: 1.0,
  fadeInDuration: 30 * 1000,
  fadeOutDuration: 5 * 1000,
  preloadSounds: true,
  duckOthers: true,
  stayAwake: true,
};

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'fading_in' | 'fading_out' | 'stopped' | 'error';

export interface PlaybackStatus {
  state: PlaybackState;
  soundId: string | null;
  position: number;
  duration: number;
  volume: number;
  isLooping: boolean;
  error?: string;
}

export const NATURE_SOUNDS: Omit<SoundAsset, 'uri'>[] = [
  { id: 'birds', name: 'Oiseaux matinaux', type: 'nature', duration: 120, loopable: true, volume: 0.7 },
  { id: 'waves', name: 'Vagues océan', type: 'nature', duration: 180, loopable: true, volume: 0.6 },
  { id: 'rain', name: 'Pluie douce', type: 'nature', duration: 240, loopable: true, volume: 0.5 },
  { id: 'forest', name: 'Forêt', type: 'nature', duration: 150, loopable: true, volume: 0.6 },
  { id: 'stream', name: 'Ruisseau', type: 'nature', duration: 180, loopable: true, volume: 0.5 },
  { id: 'wind', name: 'Vent dans les arbres', type: 'nature', duration: 200, loopable: true, volume: 0.4 },
  { id: 'crickets', name: 'Grillons', type: 'nature', duration: 120, loopable: true, volume: 0.5 },
  { id: 'thunder', name: 'Orage lointain', type: 'nature', duration: 300, loopable: true, volume: 0.4 },
];

export type SoundCategory = 'all' | 'nature' | 'custom' | 'system';