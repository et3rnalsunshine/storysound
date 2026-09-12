/**
 * Static story data for the StorySound prototype: the sample project, the AI
 * suggestions produced by the demo analysis, timeline geometry and a
 * deterministic waveform for the narration track.
 */

export type TrackId = 'narration' | 'music' | 'sfx';

export type SuggestionKind = 'pause' | 'transition' | 'intensity' | 'mix';

export type SuggestionClip = {
  /** Lane the clip is drawn on once the user accepts the suggestion. */
  track: TrackId;
  startSec: number;
  endSec: number;
  label: string;
};

export type Suggestion = {
  id: string;
  timeSec: number;
  track: TrackId;
  kind: SuggestionKind;
  /** Short label used in lists and on the suggestion card. */
  title: string;
  /** The suggestion text itself. The user can edit this. */
  detail: string;
  /** What the analysis noticed in the manuscript / narration. */
  observation: string;
  clip: SuggestionClip;
};

export const TRACKS: { id: TrackId; name: string; hint: string }[] = [
  { id: 'narration', name: 'Narration', hint: 'Your recording' },
  { id: 'music', name: 'Music', hint: 'Empty' },
  { id: 'sfx', name: 'Sound Effects', hint: 'Empty' },
];

export const TRACK_NAME: Record<TrackId, string> = {
  narration: 'Narration',
  music: 'Music',
  sfx: 'Sound Effects',
};

export const SAMPLE_PROJECT = {
  manuscriptTitle: 'The Five-Minute Tornado',
  manuscriptFileName: 'five-minute-tornado.docx',
  manuscriptWordCount: 812,
  audioFileName: 'nourinette-narration-take-3.m4a',
  audioLabel: '00:42 · 6.4 MB',
  narrationEndSec: 42,
  blurb: 'A short family story about a bathroom flood that grows out of control.',
} as const;

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 's1',
    timeSec: 8,
    track: 'narration',
    kind: 'pause',
    title: 'Add a short pause',
    detail: 'Add a short pause here to emphasize the change in the story.',
    observation: 'The manuscript turns from a calm morning scene into the first sign of trouble.',
    clip: { track: 'narration', startSec: 8, endSec: 8.8, label: 'Pause 0.8s' },
  },
  {
    id: 's2',
    timeSec: 17,
    track: 'sfx',
    kind: 'transition',
    title: 'Water-to-wind transition',
    detail: 'The tornado begins forming. Consider a subtle water-to-wind transition.',
    observation: 'Narration pace rises and the imagery moves from water to movement and air.',
    clip: { track: 'sfx', startSec: 16.4, endSec: 20.2, label: 'Water → wind' },
  },
  {
    id: 's3',
    timeSec: 24,
    track: 'sfx',
    kind: 'intensity',
    title: 'Increase sound intensity',
    detail: 'The tornado enters the hallway. Increase sound intensity.',
    observation: 'Loudest stretch of the narration, with short sentences and rising volume.',
    clip: { track: 'sfx', startSec: 23.4, endSec: 29.6, label: 'Storm intensity +4 dB' },
  },
  {
    id: 's4',
    timeSec: 32,
    track: 'music',
    kind: 'mix',
    title: 'Let her voice lead',
    detail:
      'Nourinette takes control of the situation. Reduce the chaotic background sound so her voice becomes dominant.',
    observation: 'The narrator slows down and speaks with a calmer, steadier tone.',
    clip: { track: 'music', startSec: 31.2, endSec: 38.6, label: 'Background −6 dB' },
  },
];

/** Timeline geometry. One second of audio is PX_PER_SEC wide. */
export const TIMELINE_SEC = 45;
export const PX_PER_SEC = 30;
export const TIMELINE_WIDTH = TIMELINE_SEC * PX_PER_SEC;
export const TRACK_LABEL_WIDTH = 104;
export const LANE_HEIGHT = 62;
export const RULER_HEIGHT = 26;
export const MARKER_STRIP_HEIGHT = 36;

/** Waveform resolution: BAR_WIDTH + BAR_GAP must divide PX_PER_SEC evenly. */
export const BAR_WIDTH = 3;
export const BAR_GAP = 2;
const BARS_PER_SEC = PX_PER_SEC / (BAR_WIDTH + BAR_GAP);

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Loudness envelope that follows the beats of the sample story. */
function envelopeAt(seconds: number): number {
  if (seconds > SAMPLE_PROJECT.narrationEndSec) return 0.03;
  if (seconds < 7) return 0.34;
  if (seconds < 9) return 0.42;
  if (seconds < 16) return 0.52;
  if (seconds < 23) return 0.68;
  if (seconds < 31) return 0.92;
  if (seconds < 38) return 0.6;
  return 0.4;
}

function buildNarrationWaveform(): number[] {
  const random = createRandom(20260912);
  const bars = Math.round(TIMELINE_SEC * BARS_PER_SEC);
  const values: number[] = [];

  for (let index = 0; index < bars; index += 1) {
    const seconds = index / BARS_PER_SEC;
    const syllable = 0.72 + 0.28 * Math.abs(Math.sin(index * 1.15));
    const jitter = 0.62 + 0.38 * random();
    values.push(Math.min(1, envelopeAt(seconds) * syllable * jitter));
  }

  return values;
}

export const NARRATION_WAVEFORM = buildNarrationWaveform();

/** Down-samples the narration waveform to a fixed number of bars. */
export function resampleWaveform(source: number[], bars: number): number[] {
  const step = source.length / bars;
  const out: number[] = [];

  for (let index = 0; index < bars; index += 1) {
    const from = Math.floor(index * step);
    const to = Math.max(from + 1, Math.floor((index + 1) * step));
    let peak = 0;
    for (let cursor = from; cursor < to && cursor < source.length; cursor += 1) {
      peak = Math.max(peak, source[cursor] ?? 0);
    }
    out.push(peak);
  }

  return out;
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, '');
  const words = withoutExtension.replaceAll(/[_-]+/g, ' ').trim();
  if (words.length === 0) return fileName;
  return words
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatFileSize(bytes: number | undefined): string | null {
  if (bytes === undefined || bytes <= 0) return null;
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
