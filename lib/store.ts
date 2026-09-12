import { create } from 'zustand';

import { SUGGESTIONS, type Suggestion } from '@/lib/story';

export type SuggestionStatus = 'pending' | 'edited' | 'accepted' | 'rejected';

type StoryState = {
  manuscriptTitle: string | null;
  manuscriptFileName: string | null;
  manuscriptMeta: string | null;
  audioFileName: string | null;
  audioMeta: string | null;
  isSample: boolean;
  hasAnalysed: boolean;
  /** Suggestion text, editable by the user. Keyed by suggestion id. */
  details: Record<string, string>;
  statuses: Record<string, SuggestionStatus>;
  setManuscript: (title: string, fileName: string, meta: string | null) => void;
  setNarration: (fileName: string, meta: string | null) => void;
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

  setNarration: (fileName, meta) =>
    set({ audioFileName: fileName, audioMeta: meta, isSample: false }),

  loadSample: () =>
    set({
      manuscriptTitle: 'The Five-Minute Tornado',
      manuscriptFileName: 'five-minute-tornado.docx',
      manuscriptMeta: '812 words',
      audioFileName: 'nourinette-narration-take-3.m4a',
      audioMeta: '00:42 · 6.4 MB',
      isSample: true,
    }),

  clearProject: () =>
    set({
      manuscriptTitle: null,
      manuscriptFileName: null,
      manuscriptMeta: null,
      audioFileName: null,
      audioMeta: null,
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
