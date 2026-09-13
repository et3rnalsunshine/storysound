import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { setPlayerVolume } from '@/lib/audioPlayback';

const LOAD_TIMEOUT_MS = 10_000;
const PLAY_TIMEOUT_MS = 3_000;

type PreviewLoadState = 'loading' | 'loaded' | 'failed';

export type SfxPreviewRequest = {
  /** Anything that identifies what is being previewed, e.g. a sound or cue id. */
  id: string;
  uri: string;
  volume: number;
  /** Stops the preview after this many seconds. */
  durationSec: number;
  byteLength?: number | null;
  mimeType?: string | null;
};

export type SfxPreviewDebug = {
  id: string;
  byteLength: number | null;
  mimeType: string | null;
  loadState: PreviewLoadState;
};

export type SfxPreview = {
  /** Id currently previewing, or `null` when nothing is playing. */
  playingId: string | null;
  /** Id whose player is currently loading. Loading is not treated as playback. */
  loadingId: string | null;
  error: string | null;
  debug: SfxPreviewDebug | null;
  play: (request: SfxPreviewRequest) => void;
  stop: () => void;
};

function playbackMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not play this sound: ${detail}`;
}

function waitForStatus(
  player: AudioPlayer,
  predicate: (status: AudioStatus) => boolean,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<AudioStatus> {
  const initial = player.currentStatus;
  if (initial.error !== null) return Promise.reject(new Error(initial.error));
  if (predicate(initial)) return Promise.resolve(initial);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.remove();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.error !== null) {
        clearTimeout(timer);
        subscription.remove();
        reject(new Error(status.error));
      } else if (predicate(status)) {
        clearTimeout(timer);
        subscription.remove();
        resolve(status);
      }
    });
  });
}

/**
 * Plays a single sound effect on its own, so the user can hear it before
 * accepting the suggestion. Uses its own player, independent of the narration.
 */
export function useSfxPreview(): SfxPreview {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<SfxPreviewDebug | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const releasePlayer = useCallback(() => {
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    operationRef.current += 1;
    clearTimer();
    playerRef.current?.pause();
    releasePlayer();
    setLoadingId(null);
    setPlayingId(null);
  }, [clearTimer, releasePlayer]);

  const play = useCallback(
    (request: SfxPreviewRequest) => {
      const operation = operationRef.current + 1;
      operationRef.current = operation;
      clearTimer();
      releasePlayer();
      setPlayingId(null);
      setLoadingId(request.id);
      setError(null);
      setDebug({
        id: request.id,
        byteLength: request.byteLength ?? null,
        mimeType: request.mimeType ?? null,
        loadState: 'loading',
      });
      ensureAudioSession();

      void (async () => {
        try {
          const player = createAudioPlayer(
            { uri: request.uri },
            { keepAudioSessionActive: true, updateInterval: 100 },
          );
          if (operationRef.current !== operation) {
            player.remove();
            return;
          }
          playerRef.current = player;
          player.loop = false;
          setPlayerVolume(player, request.volume);

          const loadedStatus = await waitForStatus(
            player,
            (status) => status.isLoaded && Number.isFinite(status.duration) && status.duration > 0,
            LOAD_TIMEOUT_MS,
            'The generated audio did not finish loading.',
          );
          if (operationRef.current !== operation) return;

          setDebug({
            id: request.id,
            byteLength: request.byteLength ?? null,
            mimeType: request.mimeType ?? null,
            loadState: 'loaded',
          });

          // A story cue timestamp decides when synchronized playback begins.
          // Preview uses this newly-created player at file time 0 and never
          // seeks with the story timestamp (or any untrusted value).
          player.play();

          const startedStatus = await waitForStatus(
            player,
            (status) => status.playing || status.didJustFinish,
            PLAY_TIMEOUT_MS,
            'The audio loaded, but playback did not start.',
          );
          if (operationRef.current !== operation) return;
          if (startedStatus.didJustFinish) {
            setLoadingId(null);
            releasePlayer();
            return;
          }

          statusSubscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
            if (operationRef.current !== operation) return;
            if (status.error !== null) {
              clearTimer();
              setError(playbackMessage(status.error));
              setDebug({
                id: request.id,
                byteLength: request.byteLength ?? null,
                mimeType: request.mimeType ?? null,
                loadState: 'failed',
              });
              setLoadingId(null);
              setPlayingId(null);
              releasePlayer();
            } else if (status.didJustFinish) {
              clearTimer();
              setPlayingId(null);
              releasePlayer();
            }
          });
          setLoadingId(null);
          setPlayingId(request.id);

          const requestedDuration = Number.isFinite(request.durationSec)
            ? Math.max(0, request.durationSec)
            : loadedStatus.duration;
          const previewDuration = Math.min(requestedDuration, loadedStatus.duration);
          timerRef.current = setTimeout(
            () => {
              timerRef.current = null;
              if (operationRef.current !== operation) return;
              player.pause();
              releasePlayer();
              setPlayingId(null);
            },
            Math.max(200, previewDuration * 1000),
          );
        } catch (playbackError) {
          if (operationRef.current !== operation) return;
          releasePlayer();
          setLoadingId(null);
          setPlayingId(null);
          setError(playbackMessage(playbackError));
          setDebug({
            id: request.id,
            byteLength: request.byteLength ?? null,
            mimeType: request.mimeType ?? null,
            loadState: 'failed',
          });
        }
      })();
    },
    [clearTimer, releasePlayer],
  );

  useEffect(
    () => () => {
      operationRef.current += 1;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      statusSubscriptionRef.current?.remove();
      playerRef.current?.remove();
    },
    [],
  );

  return { playingId, loadingId, error, debug, play, stop };
}
