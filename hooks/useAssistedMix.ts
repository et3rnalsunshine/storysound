import { useEffect, useRef } from 'react';

import type { Suggestion } from '@/lib/story';

/**
 * Narration gain used while the accepted suggestions play. The narration itself
 * is never re-recorded: only its level changes, and pauses are inserted as real
 * silence. Every value here comes from a suggestion the user accepted.
 */
const GAIN = {
  /** Leaves room for the suggested music and effects. */
  base: 0.85,
  /** "Let her voice lead" — the voice becomes dominant. */
  voiceLead: 1,
  /** A background swell is suggested here, so the voice sits slightly under it. */
  intensity: 0.72,
  /** Across a suggested transition. */
  transition: 0.8,
} as const;

/** Shortest inserted pause, so a very short clip is still audible. */
const MIN_PAUSE_MS = 150;
/** Window after a pause marker in which the pause is triggered. */
const PAUSE_TRIGGER_SEC = 0.35;

export type AssistedMixOptions = {
  /** Suggestions the user accepted. */
  accepted: Suggestion[];
  /** Off for the original-narration player. */
  enabled: boolean;
  position: number;
  isPlaying: boolean;
  setVolume: (volume: number) => void;
  pause: () => void;
  play: () => void;
};

/** Narration level at a given moment, following the accepted suggestions. */
export function assistedGainAt(accepted: Suggestion[], position: number): number {
  let gain = accepted.length > 0 ? GAIN.base : 1;

  for (const suggestion of accepted) {
    const { clip, kind } = suggestion;
    if (position < clip.startSec || position > clip.endSec) continue;
    if (kind === 'mix') gain = GAIN.voiceLead;
    else if (kind === 'intensity') gain = Math.min(gain, GAIN.intensity);
    else if (kind === 'transition') gain = Math.min(gain, GAIN.transition);
  }

  return gain;
}

/**
 * Plays the accepted suggestions for real: the narration level follows the
 * accepted mix notes, and accepted pauses stop playback for their exact length
 * before resuming.
 */
export function useAssistedMix(options: AssistedMixOptions): void {
  const { accepted, enabled, position, isPlaying, setVolume, pause, play } = options;
  const lastPositionRef = useRef(0);
  const handledRef = useRef(new Set<string>());
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVolume(enabled ? assistedGainAt(accepted, position) : 1);
  }, [accepted, enabled, position, setVolume]);

  useEffect(() => {
    const previous = lastPositionRef.current;
    lastPositionRef.current = position;
    // Scrubbing backwards makes the pauses ahead available again.
    if (position < previous - 0.2) handledRef.current.clear();
    if (!enabled || !isPlaying) return;

    for (const suggestion of accepted) {
      if (suggestion.kind !== 'pause') continue;
      if (handledRef.current.has(suggestion.id)) continue;
      const { startSec, endSec } = suggestion.clip;
      if (position < startSec || position > startSec + PAUSE_TRIGGER_SEC) continue;

      handledRef.current.add(suggestion.id);
      pause();
      resumeRef.current = setTimeout(
        () => {
          resumeRef.current = null;
          play();
        },
        Math.max(MIN_PAUSE_MS, (endSec - startSec) * 1000),
      );
    }
  }, [accepted, enabled, isPlaying, pause, play, position]);

  useEffect(
    () => () => {
      if (resumeRef.current !== null) clearTimeout(resumeRef.current);
    },
    [],
  );
}
