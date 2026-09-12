import { useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { ensureAudioSession } from '@/lib/audioSession';
import { setPlayerVolume } from '@/lib/audioPlayback';
import type { SfxCue } from '@/lib/sfx';

/** How close to a cue's start the playhead must be for the effect to fire. */
const TRIGGER_WINDOW_SEC = 0.4;
/** Backwards jump that counts as scrubbing, making the cues available again. */
const REWIND_TOLERANCE_SEC = 0.25;

type VoiceState = 'idle' | 'sounding' | 'held';

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

function stopVoice(voice: Voice): void {
  voice.player.pause();
  void voice.player.seekTo(0).catch(() => undefined);
  voice.state = 'idle';
}

function holdVoice(voice: Voice): void {
  if (voice.state !== 'sounding') return;
  voice.player.pause();
  voice.state = 'held';
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
      stopVoice(voice);
      voice.player.remove();
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

    if (!enabled) {
      for (const voice of voices.values()) stopVoice(voice);
      firedRef.current.clear();
      return;
    }

    if (position < previous - REWIND_TOLERANCE_SEC) {
      for (const voice of voices.values()) stopVoice(voice);
      firedRef.current.clear();
    }

    if (!isPlaying) {
      for (const voice of voices.values()) holdVoice(voice);
      return;
    }

    for (const cue of cues) {
      const key = voiceKey(cue);
      const endSec = cue.startSec + cue.durationSec;
      const voice = voices.get(key);
      const isInsideCue = position >= cue.startSec && position < endSec;

      if (!isInsideCue) {
        if (voice !== undefined && voice.state !== 'idle') stopVoice(voice);
        continue;
      }

      if (voice !== undefined && voice.state === 'sounding') {
        setPlayerVolume(voice.player, cue.volume);
        continue;
      }

      if (voice !== undefined && voice.state === 'held') {
        setPlayerVolume(voice.player, cue.volume);
        voice.player.play();
        voice.state = 'sounding';
        continue;
      }

      // Only start near the cue's timestamp, so seeking into the middle of a
      // sound effect does not fire it late.
      if (firedRef.current.has(key)) continue;
      if (position > cue.startSec + TRIGGER_WINDOW_SEC) continue;

      ensureAudioSession();
      const player = voice?.player ?? createAudioPlayer({ uri: cue.uri });
      player.loop = false;
      setPlayerVolume(player, cue.volume);
      if (player.currentTime > 0.05) void player.seekTo(0).catch(() => undefined);
      player.play();
      voices.set(key, { player, state: 'sounding' });
      firedRef.current.add(key);
    }
  }, [cues, enabled, isPlaying, position]);
}
