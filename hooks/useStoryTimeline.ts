import { useMemo } from 'react';

import { useStoryStore } from '@/lib/store';
import {
  applySfxSettings,
  resolveAllSfxSettings,
  type SfxSettings,
  type SoundAsset,
} from '@/lib/sfx';
import {
  buildNarrationWaveform,
  pxPerSecFor,
  safeNarrationSec,
  scaleSuggestions,
  type Suggestion,
  timelineSecFor,
} from '@/lib/story';

export type StoryTimeline = {
  /** Playable narration file, or `null` for the sample project. */
  audioUri: string | null;
  isSample: boolean;
  /** Real narration length once known, otherwise the sample length. */
  narrationSec: number;
  /** Narration plus a little empty room after it. */
  timelineSec: number;
  pxPerSec: number;
  timelineWidth: number;
  /** Suggestion moments mapped onto the real narration length. */
  suggestions: Suggestion[];
  /** Narration peaks: measured from the file when possible. */
  waveform: number[];
  hasMeasuredWaveform: boolean;
  /** Sound, timing and volume of every sound-effect suggestion. */
  sfxSettings: Record<string, SfxSettings>;
  /** Sound effects the user uploaded. */
  sounds: SoundAsset[];
};

/**
 * Single source of truth for timeline geometry. Everything scales with the real
 * duration of the loaded narration, so the ruler, markers, clips and waveform
 * stay aligned with what is playing. Sound-effect clips also follow the sound,
 * start time and length the user chose.
 */
export function useStoryTimeline(): StoryTimeline {
  const audioUri = useStoryStore((state) => state.audioUri);
  const audioDurationSec = useStoryStore((state) => state.audioDurationSec);
  const audioPeaks = useStoryStore((state) => state.audioPeaks);
  const isSample = useStoryStore((state) => state.isSample);
  const sounds = useStoryStore((state) => state.sounds);
  const sfxOverrides = useStoryStore((state) => state.sfxOverrides);

  const narrationSec = safeNarrationSec(audioDurationSec);
  const timelineSec = timelineSecFor(narrationSec);
  const pxPerSec = pxPerSecFor(timelineSec);

  const scaled = useMemo(() => scaleSuggestions(narrationSec), [narrationSec]);
  const sfxSettings = useMemo(
    () => resolveAllSfxSettings(scaled, sfxOverrides, narrationSec),
    [narrationSec, scaled, sfxOverrides],
  );
  const suggestions = useMemo(
    () => applySfxSettings(scaled, sfxSettings, sounds),
    [scaled, sfxSettings, sounds],
  );
  const waveform = useMemo(
    () => audioPeaks ?? buildNarrationWaveform(narrationSec),
    [audioPeaks, narrationSec],
  );

  return {
    audioUri,
    isSample,
    narrationSec,
    timelineSec,
    pxPerSec,
    timelineWidth: timelineSec * pxPerSec,
    suggestions,
    waveform,
    hasMeasuredWaveform: audioPeaks !== null,
    sfxSettings,
    sounds,
  };
}
