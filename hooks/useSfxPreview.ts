import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { setPlayerVolume } from '@/lib/audioPlayback';

export type SfxPreviewRequest = {
  /** Anything that identifies what is being previewed, e.g. a sound or cue id. */
  id: string;
  uri: string;
  volume: number;
  /** Stops the preview after this many seconds. */
  durationSec: number;
};

export type SfxPreview = {
  /** Id currently previewing, or `null` when nothing is playing. */
  playingId: string | null;
  play: (request: SfxPreviewRequest) => void;
  stop: () => void;
};

/**
 * Plays a single sound effect on its own, so the user can hear it before
 * accepting the suggestion. Uses its own player, independent of the narration.
 */
export function useSfxPreview(): SfxPreview {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const uriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    const player = playerRef.current;
    if (player !== null) {
      player.pause();
      void player.seekTo(0).catch(() => undefined);
    }
    setPlayingId(null);
  }, [clearTimer]);

  const play = useCallback(
    ({ id, uri, volume, durationSec }: SfxPreviewRequest) => {
      clearTimer();
      ensureAudioSession();

      if (playerRef.current === null || uriRef.current !== uri) {
        playerRef.current?.remove();
        playerRef.current = createAudioPlayer({ uri });
        uriRef.current = uri;
      }

      const player = playerRef.current;
      player.loop = false;
      setPlayerVolume(player, volume);
      if (player.currentTime > 0.05) void player.seekTo(0).catch(() => undefined);
      player.play();
      setPlayingId(id);

      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          player.pause();
          void player.seekTo(0).catch(() => undefined);
          setPlayingId(null);
        },
        Math.max(200, durationSec * 1000),
      );
    },
    [clearTimer],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      playerRef.current?.remove();
      playerRef.current = null;
    },
    [],
  );

  return { playingId, play, stop };
}
