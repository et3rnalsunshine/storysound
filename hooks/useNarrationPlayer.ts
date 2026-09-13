import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { usePlayhead } from '@/hooks/usePlayhead';
import { setPlayerVolume } from '@/lib/audioPlayback';

/** Status update rate. Keeps the playhead moving smoothly along the timeline. */
const UPDATE_INTERVAL_MS = 50;
/** How long a requested position is trusted before status takes over again. */
const SEEK_SETTLE_MS = 400;
const SEEK_CONFIRM_TIMEOUT_MS = 1_500;
const SEEK_CONFIRM_INTERVAL_MS = 25;
const SEEK_CONFIRM_TOLERANCE_SEC = 0.12;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export type NarrationSeekResult = {
  actualPosition: number;
  confirmed: boolean;
};

export type NarrationPlayer = {
  /** Current position in seconds. */
  position: number;
  isPlaying: boolean;
  /** Real file length, or the sample length when nothing is loaded. */
  durationSec: number;
  /** Duration reported by the file itself, or `null` before it has loaded. */
  measuredDurationSec: number | null;
  /** True while the transport is running on a timer instead of a real file. */
  isSimulated: boolean;
  isLoading: boolean;
  /** Human-readable playback problem, if any. */
  error: string | null;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  /** Pauses must be handled by the caller before awaiting this confirmed seek. */
  seekAndConfirm: (seconds: number) => Promise<NarrationSeekResult>;
  reset: () => void;
  /** 0..1. Used to hear accepted mix suggestions. */
  setVolume: (volume: number) => void;
};

/**
 * Plays the narration file the user picked, and reports its real position and
 * duration. With no file loaded (the sample project) it falls back to the
 * timer-driven playhead so the timeline still works for a walkthrough.
 */
export function useNarrationPlayer(
  uri: string | null,
  fallbackDurationSec: number,
): NarrationPlayer {
  const source = useMemo(() => (uri === null ? null : { uri }), [uri]);
  const player = useAudioPlayer(source, { updateInterval: UPDATE_INTERVAL_MS });
  const status = useAudioPlayerStatus(player);
  const {
    position: simulatedPosition,
    isPlaying: simulatedIsPlaying,
    toggle: toggleSimulated,
    play: playSimulated,
    pause: pauseSimulated,
    seek: seekSimulated,
    reset: resetSimulated,
  } = usePlayhead(fallbackDurationSec);

  const isReal = uri !== null;
  const [requestedPosition, setRequestedPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!isReal) return;
    ensureAudioSession();
  }, [isReal]);

  useEffect(() => {
    if (requestedPosition === null) return undefined;
    const timer = setTimeout(() => setRequestedPosition(null), SEEK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [requestedPosition]);

  const realDuration = status.duration > 0 ? status.duration : fallbackDurationSec;
  const realPosition = Math.max(0, Math.min(realDuration, requestedPosition ?? status.currentTime));
  const errorMessage = isReal ? (status.error ?? null) : null;

  const play = useCallback(() => {
    if (!isReal) {
      playSimulated();
      return;
    }
    if (player.duration > 0 && player.currentTime >= player.duration - 0.08) {
      setRequestedPosition(0);
      void player.seekTo(0);
    }
    player.play();
  }, [isReal, player, playSimulated]);

  const pause = useCallback(() => {
    if (isReal) player.pause();
    else pauseSimulated();
  }, [isReal, player, pauseSimulated]);

  const toggle = useCallback(() => {
    if (!isReal) {
      toggleSimulated();
      return;
    }
    if (status.playing) player.pause();
    else play();
  }, [isReal, player, play, status.playing, toggleSimulated]);

  const seek = useCallback(
    (seconds: number) => {
      if (!isReal) {
        seekSimulated(seconds);
        return;
      }
      const limit = player.duration > 0 ? player.duration : fallbackDurationSec;
      const clamped = Math.max(0, Math.min(limit, seconds));
      setRequestedPosition(clamped);
      void player.seekTo(clamped);
    },
    [fallbackDurationSec, isReal, player, seekSimulated],
  );

  const seekAndConfirm = useCallback(
    async (seconds: number): Promise<NarrationSeekResult> => {
      const limit = player.duration > 0 ? player.duration : fallbackDurationSec;
      const clamped = Math.max(0, Math.min(limit, Number.isFinite(seconds) ? seconds : 0));

      if (!isReal) {
        seekSimulated(clamped);
        return { actualPosition: clamped, confirmed: true };
      }

      setRequestedPosition(clamped);
      await player.seekTo(clamped);

      const deadline = Date.now() + SEEK_CONFIRM_TIMEOUT_MS;
      let actualPosition = player.currentTime;
      while (
        (!Number.isFinite(actualPosition) ||
          Math.abs(actualPosition - clamped) > SEEK_CONFIRM_TOLERANCE_SEC) &&
        Date.now() < deadline
      ) {
        await wait(SEEK_CONFIRM_INTERVAL_MS);
        actualPosition = player.currentTime;
      }

      const finitePosition = Number.isFinite(actualPosition) ? actualPosition : 0;
      return {
        actualPosition: finitePosition,
        confirmed: Math.abs(finitePosition - clamped) <= SEEK_CONFIRM_TOLERANCE_SEC,
      };
    },
    [fallbackDurationSec, isReal, player, seekSimulated],
  );

  const reset = useCallback(() => {
    if (!isReal) {
      resetSimulated();
      return;
    }
    player.pause();
    setRequestedPosition(0);
    void player.seekTo(0);
  }, [isReal, player, resetSimulated]);

  const setVolume = useCallback(
    (volume: number) => {
      if (!isReal) return;
      setPlayerVolume(player, volume);
    },
    [isReal, player],
  );

  return {
    position: isReal ? realPosition : simulatedPosition,
    isPlaying: isReal ? status.playing : simulatedIsPlaying,
    durationSec: isReal ? realDuration : fallbackDurationSec,
    measuredDurationSec: isReal && status.duration > 0 ? status.duration : null,
    isSimulated: !isReal,
    isLoading: isReal && !status.isLoaded && errorMessage === null,
    error: errorMessage,
    toggle,
    play,
    pause,
    seek,
    seekAndConfirm,
    reset,
    setVolume,
  };
}
