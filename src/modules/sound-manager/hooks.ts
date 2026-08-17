import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundManager, getSoundManager } from './SoundManager';
import { SoundAsset, PlaybackStatus, PlaybackConfig } from './types';

export function useSoundManager(config?: ConstructorParameters<typeof getSoundManager>[0]) {
  const [manager] = useState(() => getSoundManager(config));
  const [status, setStatus] = useState<PlaybackStatus>({
    state: 'idle',
    soundId: null,
    position: 0,
    duration: 0,
    volume: 0.7,
    isLooping: false,
  });
  const [sounds, setSounds] = useState<SoundAsset[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      await manager.initialize();
      manager.setStatusCallback((s) => {
        if (mounted) setStatus(s);
      });
      if (mounted) {
        setSounds(manager.getAllSounds());
        setInitialized(true);
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [manager]);

  const play = useCallback(async (soundId: string, options?: Partial<PlaybackConfig>) => {
    await manager.play(soundId, options);
  }, [manager]);

  const playAlarm = useCallback(async (soundId: string, volume: number, fadeInDuration: number) => {
    await manager.playAlarm(soundId, volume, fadeInDuration);
  }, [manager]);

  const pause = useCallback(async () => {
    await manager.pause();
  }, [manager]);

  const resume = useCallback(async () => {
    await manager.resume();
  }, [manager]);

  const stop = useCallback(async (fadeOut = true) => {
    await manager.stop(fadeOut);
  }, [manager]);

  const setVolume = useCallback(async (volume: number) => {
    await manager.setVolume(volume);
  }, [manager]);

  const addCustomSound = useCallback((asset: SoundAsset) => {
    manager.addCustomSound(asset);
    setSounds(manager.getAllSounds());
  }, [manager]);

  const removeCustomSound = useCallback((soundId: string) => {
    const result = manager.removeCustomSound(soundId);
    if (result) setSounds(manager.getAllSounds());
    return result;
  }, [manager]);

  const getSoundsByCategory = useCallback((category: 'all' | 'nature' | 'custom' | 'system') => {
    return manager.getAllSounds(category);
  }, [manager]);

  return {
    manager,
    status,
    sounds,
    initialized,
    play,
    playAlarm,
    pause,
    resume,
    stop,
    setVolume,
    addCustomSound,
    removeCustomSound,
    getSoundsByCategory,
    isPlaying: status.state === 'playing' || status.state === 'fading_in',
  };
}

export function useAlarmSound(
  soundId: string,
  volume: number,
  fadeInDuration: number
) {
  const { playAlarm, stop, status, isPlaying } = useSoundManager();
  const playingRef = useRef(false);

  const trigger = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    await playAlarm(soundId, volume, fadeInDuration);
  }, [playAlarm, soundId, volume, fadeInDuration]);

  const dismiss = useCallback(async () => {
    if (!playingRef.current) return;
    playingRef.current = false;
    await stop(true);
  }, [stop]);

  const snooze = useCallback(async (snoozeDuration: number) => {
    if (!playingRef.current) return;
    playingRef.current = false;
    await stop(true);
    
    setTimeout(() => {
      playingRef.current = true;
      playAlarm(soundId, volume, fadeInDuration);
    }, snoozeDuration);
  }, [playAlarm, stop, soundId, volume, fadeInDuration]);

  return {
    trigger,
    dismiss,
    snooze,
    isPlaying,
    status,
  };
}