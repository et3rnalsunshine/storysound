import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { setPlayerVolume } from '@/lib/audioPlayback';
import type { SfxCue } from '@/lib/sfx';

/** Backwards jump that counts as scrubbing, making the cues available again. */
const REWIND_TOLERANCE_SEC = 0.25;
const LOAD_TIMEOUT_MS = 10_000;
const PLAY_TIMEOUT_MS = 3_000;

type VoiceState = 'loading' | 'sounding' | 'held' | 'idle';

type Voice = {
  player: AudioPlayer;
  state: VoiceState;
};

export type SfxSchedulerOptions = {
  /** Accepted sound effects that point at a real file. */
  cues: SfxCue[];
  /** Off for the original-narration player, which stays dry. */
  enabled: boolean;
  /** Narration position in seconds. */
  position: number;
  isPlaying: boolean;
};

export type SfxPlaybackDebug = Record<string, { triggered: boolean }>;

export type SfxScheduler = {
  playbackDebug: SfxPlaybackDebug;
  /** Stops active voices and makes every live cue available to trigger again. */
  resetTriggers: () => void;
};

/** One player per cue, file and live timeline placement. */
function voiceKey(cue: SfxCue): string {
  return `${cue.id}::${cue.uri}::${cue.startSec}::${cue.durationSec}`;
}

function releaseVoice(voice: Voice): void {
  voice.player.pause();
  voice.player.remove();
  voice.state = 'idle';
}

function holdVoice(voice: Voice): void {
  if (voice.state !== 'sounding') return;
  voice.player.pause();
  voice.state = 'held';
}

function waitForStatus(
  player: AudioPlayer,
  predicate: (status: AudioStatus) => boolean,
  timeoutMs: number,
): Promise<AudioStatus> {
  const initial = player.currentStatus;
  if (initial.error !== null) return Promise.reject(new Error(initial.error));
  if (predicate(initial)) return Promise.resolve(initial);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.remove();
      reject(new Error('Sound effect playback timed out.'));
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
 * Plays accepted sound effects on top of the narration.
 *
 * The narration keeps its own player and is never stopped for an effect: each
 * cue gets a separate expo-audio player, started when the playhead reaches its
 * timestamp and stopped when its chosen length is over. Volume follows the
 * intensity the user picked.
 */
export function useSfxScheduler({
  cues,
  enabled,
  position,
  isPlaying,
}: SfxSchedulerOptions): SfxScheduler {
  const voicesRef = useRef(new Map<string, Voice>());
  const firedRef = useRef(new Set<string>());
  const cueKeysRef = useRef(new Map<string, string>());
  const lastPositionRef = useRef(0);
  const [playbackDebug, setPlaybackDebug] = useState<SfxPlaybackDebug>({});

  const resetTriggers = useCallback(() => {
    for (const voice of voicesRef.current.values()) releaseVoice(voice);
    voicesRef.current.clear();
    firedRef.current.clear();
    setPlaybackDebug(() => {
      const next: SfxPlaybackDebug = {};
      for (const cue of cues) next[cue.id] = { triggered: false };
      return next;
    });
  }, [cues]);

  // Release players and reset trigger state for cues that were rejected,
  // retimed or repointed. The timing-aware key makes edits effective at once.
  useEffect(() => {
    const live = new Set(cues.map(voiceKey));
    for (const [key, voice] of voicesRef.current) {
      if (live.has(key)) continue;
      releaseVoice(voice);
      voicesRef.current.delete(key);
      firedRef.current.delete(key);
    }

    const nextKeys = new Map(cues.map((cue) => [cue.id, voiceKey(cue)]));
    setPlaybackDebug((current) => {
      const next: SfxPlaybackDebug = {};
      for (const cue of cues) {
        next[cue.id] = {
          triggered:
            cueKeysRef.current.get(cue.id) === nextKeys.get(cue.id) &&
            (current[cue.id]?.triggered ?? false),
        };
      }
      return next;
    });
    cueKeysRef.current = nextKeys;
  }, [cues]);

  useEffect(() => {
    const voices = voicesRef.current;
    return () => {
      for (const voice of voices.values()) {
        voice.player.pause();
        voice.player.remove();
      }
      voices.clear();
    };
  }, []);

  useEffect(() => {
    const voices = voicesRef.current;
    const previous = lastPositionRef.current;
    lastPositionRef.current = position;

    const releaseAll = () => {
      for (const voice of voices.values()) releaseVoice(voice);
      voices.clear();
    };

    const resetTriggerDebug = () => {
      setPlaybackDebug(() => {
        const next: SfxPlaybackDebug = {};
        for (const cue of cues) next[cue.id] = { triggered: false };
        return next;
      });
    };

    if (!enabled) {
      releaseAll();
      firedRef.current.clear();
      resetTriggerDebug();
      return;
    }

    if (position < previous - REWIND_TOLERANCE_SEC) {
      releaseAll();
      firedRef.current.clear();
      resetTriggerDebug();
    }

    if (!isPlaying) {
      for (const [key, voice] of voices) {
        if (voice.state === 'loading') {
          releaseVoice(voice);
          voices.delete(key);
        } else {
          holdVoice(voice);
        }
      }
      return;
    }

    const activeKeys = new Set(cues.map(voiceKey));
    for (const [key, voice] of voices) {
      if (activeKeys.has(key)) continue;
      releaseVoice(voice);
      voices.delete(key);
    }

    for (const cue of cues) {
      const key = voiceKey(cue);
      const voice = voices.get(key);
      const cueIsFinite =
        Number.isFinite(cue.startSec) &&
        Number.isFinite(cue.durationSec) &&
        cue.startSec >= 0 &&
        cue.durationSec > 0;
      const endSec = cue.startSec + cue.durationSec;
      const isInsideCue =
        cueIsFinite && Number.isFinite(position) && position >= cue.startSec && position < endSec;

      if (!isInsideCue) {
        if (voice !== undefined) {
          releaseVoice(voice);
          voices.delete(key);
        }
        continue;
      }

      if (voice?.state === 'loading') continue;

      if (voice?.state === 'sounding') {
        setPlayerVolume(voice.player, cue.volume);
        continue;
      }

      if (voice?.state === 'held') {
        setPlayerVolume(voice.player, cue.volume);
        voice.player.play();
        voice.state = 'sounding';
        continue;
      }

      // The story timestamp only decides when to create the SFX player. A new
      // player begins at file time 0; the narration timestamp is never a seek.
      if (firedRef.current.has(key)) continue;

      ensureAudioSession();
      const player = createAudioPlayer(
        { uri: cue.uri },
        { keepAudioSessionActive: true, updateInterval: 100 },
      );
      const nextVoice: Voice = { player, state: 'loading' };
      voices.set(key, nextVoice);
      player.loop = false;
      setPlayerVolume(player, cue.volume);

      void (async () => {
        try {
          await waitForStatus(
            player,
            (status) => status.isLoaded && Number.isFinite(status.duration) && status.duration > 0,
            LOAD_TIMEOUT_MS,
          );
          if (voices.get(key) !== nextVoice || nextVoice.state !== 'loading') return;

          player.play();
          const started = await waitForStatus(
            player,
            (status) => status.playing || status.didJustFinish,
            PLAY_TIMEOUT_MS,
          );
          if (voices.get(key) !== nextVoice || nextVoice.state !== 'loading') return;

          firedRef.current.add(key);
          setPlaybackDebug((current) => ({
            ...current,
            [cue.id]: { triggered: true },
          }));
          if (started.didJustFinish) {
            releaseVoice(nextVoice);
            voices.delete(key);
          } else {
            nextVoice.state = 'sounding';
          }
        } catch {
          if (voices.get(key) !== nextVoice) return;
          releaseVoice(nextVoice);
          voices.delete(key);
          firedRef.current.delete(key);
        }
      })();
    }
  }, [cues, enabled, isPlaying, position]);

  return { playbackDebug, resetTriggers };
}
