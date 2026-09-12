import { create } from 'zustand';

import { SAMPLE_PROJECT, SUGGESTIONS, type Suggestion } from '@/lib/story';

export type SuggestionStatus = 'pending' | 'edited' | 'accepted' | 'rejected';

type StoryState = {
  manuscriptTitle: string | null;
  manuscriptFileName: string | null;
  manuscriptMeta: string | null;
  audioFileName: string | null;
  audioMeta: string | null;
  /** Playable URI of the picked narration file. `null` for the sample project. */
  audioUri: string | null;
  /** Real narration length in seconds, once the file has been read. */
  audioDurationSec: number | null;
  /** Measured waveform peaks, when the platform can decode the file. */
  audioPeaks: number[] | null;
  isSample: boolean;
  hasAnalysed: boolean;
  /** Suggestion text, editable by the user. Keyed by suggestion id. */
  details: Record<string, string>;
  statuses: Record<string, SuggestionStatus>;
  setManuscript: (title: string, fileName: string, meta: string | null) => void;
  setNarration: (fileName: string, meta: string | null, uri: string | null) => void;
  setNarrationAnalysis: (durationSec: number, peaks: number[] | null) => void;
  setNarrationDuration: (durationSec: number) => void;
  loadSample: () => void;
  clearProject: () => void;
  completeAnalysis: () => void;
  setStatus: (id: string, status: SuggestionStatus) => void;
  saveDetail: (id: string, detail: string) => void;
  resetDecisions: () => void;
};

function initialDetails(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const suggestion of SUGGESTIONS) entries[suggestion.id] = suggestion.detail;
  return entries;
}

function initialStatuses(): Record<string, SuggestionStatus> {
  const entries: Record<string, SuggestionStatus> = {};
  for (const suggestion of SUGGESTIONS) entries[suggestion.id] = 'pending';
  return entries;
}

export const useStoryStore = create<StoryState>()((set) => ({
  manuscriptTitle: null,
  manuscriptFileName: null,
  manuscriptMeta: null,
  audioFileName: null,
  audioMeta: null,
  audioUri: null,
  audioDurationSec: null,
  audioPeaks: null,
  isSample: false,
  hasAnalysed: false,
  details: initialDetails(),
  statuses: initialStatuses(),

  setManuscript: (title, fileName, meta) =>
    set({
      manuscriptTitle: title,
      manuscriptFileName: fileName,
      manuscriptMeta: meta,
      isSample: false,
    }),

  setNarration: (fileName, meta, uri) =>
    set({
      audioFileName: fileName,
      audioMeta: meta,
      audioUri: uri,
      audioDurationSec: null,
      audioPeaks: null,
      isSample: false,
    }),

  setNarrationAnalysis: (durationSec, peaks) =>
    set({
      audioDurationSec: durationSec > 0 ? durationSec : null,
      audioPeaks: peaks !== null && peaks.length > 0 ? peaks : null,
    }),

  setNarrationDuration: (durationSec) =>
    set((state) => {
      if (durationSec <= 0) return state;
      const known = state.audioDurationSec;
      if (known !== null && Math.abs(known - durationSec) < 0.05) return state;
      return { audioDurationSec: durationSec };
    }),

  loadSample: () =>
    set({
      manuscriptTitle: SAMPLE_PROJECT.manuscriptTitle,
      manuscriptFileName: SAMPLE_PROJECT.manuscriptFileName,
      manuscriptMeta: `${SAMPLE_PROJECT.manuscriptWordCount} words`,
      audioFileName: SAMPLE_PROJECT.audioFileName,
      audioMeta: SAMPLE_PROJECT.audioLabel,
      audioUri: null,
      audioDurationSec: SAMPLE_PROJECT.narrationEndSec,
      audioPeaks: null,
      isSample: true,
    }),

  clearProject: () =>
    set({
      manuscriptTitle: null,
      manuscriptFileName: null,
      manuscriptMeta: null,
      audioFileName: null,
      audioMeta: null,
      audioUri: null,
      audioDurationSec: null,
      audioPeaks: null,
      isSample: false,
      hasAnalysed: false,
      details: initialDetails(),
      statuses: initialStatuses(),
    }),

  completeAnalysis: () => set({ hasAnalysed: true }),

  setStatus: (id, status) => set((state) => ({ statuses: { ...state.statuses, [id]: status } })),

  saveDetail: (id, detail) =>
    set((state) => ({
      details: { ...state.details, [id]: detail },
      statuses: {
        ...state.statuses,
        [id]: state.statuses[id] === 'accepted' ? 'accepted' : 'edited',
      },
    })),

  resetDecisions: () => set({ details: initialDetails(), statuses: initialStatuses() }),
}));

export function isSuggestionEdited(suggestion: Suggestion, detail: string): boolean {
  return detail.trim() !== suggestion.detail.trim();
}
