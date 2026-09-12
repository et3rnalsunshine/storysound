import { useMemo } from 'react';

import { useStoryStore } from '@/lib/store';
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
};

/**
 * Single source of truth for timeline geometry. Everything scales with the real
 * duration of the loaded narration, so the ruler, markers, clips and waveform
 * stay aligned with what is playing.
 */
export function useStoryTimeline(): StoryTimeline {
  const audioUri = useStoryStore((state) => state.audioUri);
  const audioDurationSec = useStoryStore((state) => state.audioDurationSec);
  const audioPeaks = useStoryStore((state) => state.audioPeaks);
  const isSample = useStoryStore((state) => state.isSample);

  const narrationSec = safeNarrationSec(audioDurationSec);
  const timelineSec = timelineSecFor(narrationSec);
  const pxPerSec = pxPerSecFor(timelineSec);

  const suggestions = useMemo(() => scaleSuggestions(narrationSec), [narrationSec]);
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
  };
}
