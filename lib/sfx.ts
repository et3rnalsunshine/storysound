/**
 * Sound-effect library and cue model for StorySound.
 *
 * A sound effect is either a file the user uploaded or one generated from a
 * description through the backend sound-generation function. Either way it lands
 * in the same small library, and a sound-effect suggestion points at one of them.
 * The suggestion keeps its Accept / Modify / Reject controls: the sound, its
 * description, start time, length and volume are all the user's choice, and
 * nothing is heard until the suggestion is accepted.
 */

import { type Suggestion, type SuggestionKind } from '@/lib/story';

/** Where a sound came from. */
export type SoundSource = 'upload' | 'generated';

export type SoundAsset = {
  id: string;
  /** User-facing name, e.g. "Wind forming". */
  name: string;
  fileName: string;
  /** Playable URI. Files are copied into the app cache when picked or generated. */
  uri: string;
  sizeLabel: string | null;
  /** Decoded byte count and MIME type, kept for generated-audio diagnostics. */
  byteLength: number | null;
  mimeType: string | null;
  source: SoundSource;
  /** Description the sound was generated from, or `null` for uploads. */
  prompt: string | null;
};

export type SfxSettings = {
  /** Chosen sound from the library, or `null` while nothing is chosen yet. */
  soundId: string | null;
  /** Description used to generate the sound. The user can rewrite it. */
  prompt: string;
  startSec: number;
  /** How long the effect is allowed to sound for. */
  durationSec: number;
  /** Intensity of the effect, 0..1. */
  volume: number;
};

/** A sound effect that is accepted, has a file, and is ready to be played. */
export type SfxCue = {
  /** Suggestion the cue belongs to. */
  id: string;
  soundId: string;
  soundName: string;
  uri: string;
  source: SoundSource;
  startSec: number;
  durationSec: number;
  volume: number;
};

/** Names that suit the sample story, offered as one-tap labels on upload. */
export const SFX_NAME_PRESETS = [
  'Water dripping',
  'Wind forming',
  'Tornado / strong wind',
  'Objects crashing',
] as const;

export const MIN_SFX_DURATION_SEC = 0.5;
export const MAX_SFX_DURATION_SEC = 20;

/** Prompt limits mirrored from the backend generation function. */
export const MIN_SFX_PROMPT_LENGTH = 3;
export const MAX_SFX_PROMPT_LENGTH = 500;

/** True when a description is long enough to send to the generator. */
export function isPromptReady(prompt: string): boolean {
  return prompt.trim().length >= MIN_SFX_PROMPT_LENGTH;
}

/** Short library name taken from the sound description, e.g. "Dripping water". */
export function soundNameFromPrompt(prompt: string): string {
  const words = prompt.trim().replaceAll(/\s+/g, ' ').split(' ').slice(0, 4).join(' ');
  const clean = words.replace(/[,.;:]+$/, '');
  if (clean.length === 0) return 'Generated sound';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Starting intensity suggested for each kind of note. */
function defaultVolumeFor(kind: SuggestionKind): number {
  if (kind === 'intensity') return 0.9;
  if (kind === 'transition') return 0.65;
  return 0.75;
}

/** True for suggestions that place a sound effect on the Sound Effects lane. */
export function isSfxSuggestion(suggestion: Suggestion): boolean {
  return suggestion.clip.track === 'sfx';
}

/** What the analysis proposes, before the user changes anything. */
export function defaultSfxSettings(suggestion: Suggestion): SfxSettings {
  const length = suggestion.clip.endSec - suggestion.clip.startSec;
  return {
    soundId: null,
    prompt: suggestion.sfxPrompt ?? suggestion.detail,
    startSec: round1(suggestion.clip.startSec),
    durationSec: round1(clamp(length, MIN_SFX_DURATION_SEC, MAX_SFX_DURATION_SEC)),
    volume: defaultVolumeFor(suggestion.kind),
  };
}

/** Keeps a cue inside the narration and inside the allowed lengths. */
export function clampSfxSettings(settings: SfxSettings, narrationSec: number): SfxSettings {
  const lastStart = Math.max(0, narrationSec - MIN_SFX_DURATION_SEC);
  const startSec = clamp(settings.startSec, 0, lastStart);
  const maxDuration = Math.max(
    MIN_SFX_DURATION_SEC,
    Math.min(MAX_SFX_DURATION_SEC, narrationSec - startSec),
  );

  return {
    soundId: settings.soundId,
    prompt: settings.prompt.slice(0, MAX_SFX_PROMPT_LENGTH),
    startSec: round1(startSec),
    durationSec: round1(clamp(settings.durationSec, MIN_SFX_DURATION_SEC, maxDuration)),
    volume: clamp(settings.volume, 0, 1),
  };
}

/** Longest length a cue may have from a given start point. */
export function maxSfxDurationFor(startSec: number, narrationSec: number): number {
  return Math.max(MIN_SFX_DURATION_SEC, Math.min(MAX_SFX_DURATION_SEC, narrationSec - startSec));
}

/** The user's settings for one suggestion, falling back to the AI defaults. */
export function resolveSfxSettings(
  suggestion: Suggestion,
  override: Partial<SfxSettings> | undefined,
  narrationSec: number,
): SfxSettings {
  const base = defaultSfxSettings(suggestion);
  return clampSfxSettings({ ...base, ...override }, narrationSec);
}

/** Resolved settings for every sound-effect suggestion, keyed by suggestion id. */
export function resolveAllSfxSettings(
  suggestions: Suggestion[],
  overrides: Record<string, Partial<SfxSettings>>,
  narrationSec: number,
): Record<string, SfxSettings> {
  const resolved: Record<string, SfxSettings> = {};
  for (const suggestion of suggestions) {
    if (!isSfxSuggestion(suggestion)) continue;
    resolved[suggestion.id] = resolveSfxSettings(
      suggestion,
      overrides[suggestion.id],
      narrationSec,
    );
  }
  return resolved;
}

export function soundById(sounds: SoundAsset[], soundId: string | null): SoundAsset | null {
  if (soundId === null) return null;
  return sounds.find((sound) => sound.id === soundId) ?? null;
}

/**
 * Moves sound-effect clips onto the timeline positions the user chose and names
 * them after the chosen file, so the lane shows what will actually be heard.
 */
export function applySfxSettings(
  suggestions: Suggestion[],
  resolved: Record<string, SfxSettings>,
  sounds: SoundAsset[],
): Suggestion[] {
  return suggestions.map((suggestion) => {
    const settings = resolved[suggestion.id];
    if (settings === undefined) return suggestion;

    const sound = soundById(sounds, settings.soundId);

    return {
      ...suggestion,
      timeSec: settings.startSec,
      clip: {
        ...suggestion.clip,
        startSec: settings.startSec,
        endSec: round1(settings.startSec + settings.durationSec),
        label: sound === null ? suggestion.clip.label : sound.name,
      },
    };
  });
}

/** Playable cues: accepted sound-effect suggestions that point at a real file. */
export function sfxCuesFor(
  accepted: Suggestion[],
  resolved: Record<string, SfxSettings>,
  sounds: SoundAsset[],
): SfxCue[] {
  const cues: SfxCue[] = [];

  for (const suggestion of accepted) {
    const settings = resolved[suggestion.id];
    if (settings === undefined) continue;
    const sound = soundById(sounds, settings.soundId);
    if (sound === null) continue;

    cues.push({
      id: suggestion.id,
      soundId: sound.id,
      soundName: sound.name,
      uri: sound.uri,
      source: sound.source,
      startSec: settings.startSec,
      durationSec: settings.durationSec,
      volume: settings.volume,
    });
  }

  return cues;
}

export function formatSfxDuration(seconds: number): string {
  return `${round1(seconds).toFixed(1)}s`;
}

export function formatSfxVolume(volume: number): string {
  return `${Math.round(clamp(volume, 0, 1) * 100)}%`;
}

/** Precise timestamp for a cue, e.g. "00:16.4". */
export function formatCueTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Parses MM:SS.s or raw seconds without ever returning a non-finite value. */
export function parseCueTime(value: string): number | null {
  const clean = value.trim();
  if (clean.length === 0) return null;

  const parts = clean.split(':');
  if (parts.length > 2) return null;

  const minutes = parts.length === 2 ? Number(parts[0]) : 0;
  const seconds = Number(parts.length === 2 ? parts[1] : parts[0]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || (parts.length === 2 && seconds >= 60)) return null;

  const total = minutes * 60 + seconds;
  return Number.isFinite(total) ? round1(total) : null;
}
