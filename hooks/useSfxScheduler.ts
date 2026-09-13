import { useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { setPlayerVolume } from '@/lib/audioPlayback';
import type { SfxCue } from '@/lib/sfx';

/** How close to a cue's start the playhead must be for the effect to fire. */
const TRIGGER_WINDOW_SEC = 0.4;
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

/** One player per cue and file, so the same sound can be used twice. */
function voiceKey(cue: SfxCue): string {
  return `${cue.id}::${cue.uri}`;
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
export function useSfxScheduler({ cues, enabled, position, isPlaying }: SfxSchedulerOptions): void {
  const voicesRef = useRef(new Map<string, Voice>());
  const firedRef = useRef(new Set<string>());
  const lastPositionRef = useRef(0);

  // Release players for cues that were rejected, retimed or repointed.
  useEffect(() => {
    const live = new Set(cues.map(voiceKey));
    for (const [key, voice] of voicesRef.current) {
      if (live.has(key)) continue;
      releaseVoice(voice);
      voicesRef.current.delete(key);
      firedRef.current.delete(key);
    }
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

    if (!enabled) {
      releaseAll();
      firedRef.current.clear();
      return;
    }

    if (position < previous - REWIND_TOLERANCE_SEC) {
      releaseAll();
      firedRef.current.clear();
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
      if (position > cue.startSec + TRIGGER_WINDOW_SEC) continue;

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
}
