import { create } from 'zustand';

import { type SfxSettings, type SoundAsset, type SoundSource } from '@/lib/sfx';
import { SAMPLE_PROJECT, SUGGESTIONS, type Suggestion } from '@/lib/story';

export type SuggestionStatus = 'pending' | 'edited' | 'accepted' | 'rejected';

export type NewSound = {
  name: string;
  fileName: string;
  uri: string;
  sizeLabel: string | null;
  byteLength: number | null;
  mimeType: string | null;
  source: SoundSource;
  /** Description the sound was generated from, or `null` for uploads. */
  prompt: string | null;
};

/** State of a sound-generation request for one suggestion. */
export type SfxJob =
  | { state: 'generating' }
  | { state: 'error'; message: string; retryable: boolean };

function createSoundId(): string {
  return `snd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toSoundAsset(sound: NewSound, id: string): SoundAsset {
  return {
    id,
    name: sound.name.trim().length > 0 ? sound.name.trim() : sound.fileName,
    fileName: sound.fileName,
    uri: sound.uri,
    sizeLabel: sound.sizeLabel,
    byteLength: sound.byteLength,
    mimeType: sound.mimeType,
    source: sound.source,
    prompt: sound.prompt,
  };
}

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
  /** Uploaded and generated sound-effect files, reusable across projects. */
  sounds: SoundAsset[];
  /** What the user changed on a sound-effect suggestion. Keyed by suggestion id. */
  sfxOverrides: Record<string, Partial<SfxSettings>>;
  /** Sound-generation state per suggestion id. */
  sfxJobs: Record<string, SfxJob>;
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
  addSound: (sound: NewSound) => string;
  renameSound: (id: string, name: string) => void;
  removeSound: (id: string) => void;
  /** Stores the sound, timing or volume the user chose for a suggestion. */
  setSfxOverride: (id: string, patch: Partial<SfxSettings>) => void;
  /**
   * Adds a freshly generated sound and points the suggestion at it. Replaces the
   * generated sound it had before, so regenerating does not fill the library.
   */
  attachGeneratedSound: (
    suggestionId: string,
    sound: NewSound,
    patch: Partial<SfxSettings>,
  ) => void;
  startSfxJob: (id: string) => void;
  failSfxJob: (id: string, message: string, retryable: boolean) => void;
  clearSfxJob: (id: string) => void;
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
  sounds: [],
  sfxOverrides: {},
  sfxJobs: {},

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
      sfxOverrides: {},
      sfxJobs: {},
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

  addSound: (sound) => {
    const id = createSoundId();
    set((state) => ({ sounds: [...state.sounds, toSoundAsset(sound, id)] }));
    return id;
  },

  renameSound: (id, name) =>
    set((state) => ({
      sounds: state.sounds.map((sound) => (sound.id === id ? { ...sound, name } : sound)),
    })),

  removeSound: (id) =>
    set((state) => {
      const overrides: Record<string, Partial<SfxSettings>> = {};
      for (const [suggestionId, override] of Object.entries(state.sfxOverrides)) {
        overrides[suggestionId] =
          override.soundId === id ? { ...override, soundId: null } : override;
      }
      return { sounds: state.sounds.filter((sound) => sound.id !== id), sfxOverrides: overrides };
    }),

  setSfxOverride: (id, patch) =>
    set((state) => ({
      sfxOverrides: { ...state.sfxOverrides, [id]: { ...state.sfxOverrides[id], ...patch } },
    })),

  attachGeneratedSound: (suggestionId, sound, patch) =>
    set((state) => {
      const id = createSoundId();
      const previousId = state.sfxOverrides[suggestionId]?.soundId ?? null;

      const sfxOverrides = {
        ...state.sfxOverrides,
        [suggestionId]: { ...state.sfxOverrides[suggestionId], ...patch, soundId: id },
      };

      const previous = state.sounds.find((item) => item.id === previousId) ?? null;
      const usedElsewhere = Object.values(sfxOverrides).some(
        (override) => override.soundId === previousId,
      );
      const dropPrevious = previous !== null && previous.source === 'generated' && !usedElsewhere;

      const sounds = dropPrevious
        ? state.sounds.filter((item) => item.id !== previous.id)
        : state.sounds;

      return { sounds: [...sounds, toSoundAsset(sound, id)], sfxOverrides };
    }),

  startSfxJob: (id) =>
    set((state) => ({ sfxJobs: { ...state.sfxJobs, [id]: { state: 'generating' } } })),

  failSfxJob: (id, message, retryable) =>
    set((state) => ({
      sfxJobs: { ...state.sfxJobs, [id]: { state: 'error', message, retryable } },
    })),

  clearSfxJob: (id) =>
    set((state) => {
      if (state.sfxJobs[id] === undefined) return state;
      const sfxJobs = { ...state.sfxJobs };
      delete sfxJobs[id];
      return { sfxJobs };
    }),
}));

export function isSuggestionEdited(suggestion: Suggestion, detail: string): boolean {
  return detail.trim() !== suggestion.detail.trim();
}
