/**
 * Story data and timeline geometry for StorySound.
 *
 * The AI suggestions are authored against the sample narration (42 s). When a
 * real narration file is loaded, `scaleSuggestions` maps those moments onto the
 * real duration and the timeline geometry is derived from it, so the ruler, the
 * markers and the waveform all line up with the audio that is actually playing.
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
  /** Sound description proposed for a sound-effect note. The user can rewrite it. */
  sfxPrompt?: string;
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

/** Narration length the suggestions below were written for. */
export const BASE_NARRATION_SEC = SAMPLE_PROJECT.narrationEndSec;

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
    sfxPrompt:
      'Dripping water fading into a low rising wind, a subtle build-up of tension, no music',
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
    sfxPrompt:
      'Strong tornado wind roaring down a narrow hallway, doors rattling and small objects crashing',
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

/** Timeline geometry. */
export const BASE_PX_PER_SEC = 30;
export const MIN_PX_PER_SEC = 9;
/** Longest scrollable strip we draw, so long files stay smooth. */
export const MAX_TIMELINE_WIDTH = 4500;
/** Empty room drawn after the narration ends. */
export const TIMELINE_TAIL_SEC = 3;
export const TRACK_LABEL_WIDTH = 104;
export const LANE_HEIGHT = 62;
export const RULER_HEIGHT = 26;
export const MARKER_STRIP_HEIGHT = 36;

/** Waveform resolution. */
export const BAR_WIDTH = 3;
export const BAR_GAP = 2;
export const BARS_PER_SEC = BASE_PX_PER_SEC / (BAR_WIDTH + BAR_GAP);

export function safeNarrationSec(narrationSec: number | null | undefined): number {
  if (typeof narrationSec !== 'number' || !Number.isFinite(narrationSec) || narrationSec <= 0) {
    return BASE_NARRATION_SEC;
  }
  return narrationSec;
}

/** Total timeline length: the narration plus a little empty room after it. */
export function timelineSecFor(narrationSec: number): number {
  return Math.ceil(safeNarrationSec(narrationSec)) + TIMELINE_TAIL_SEC;
}

/** Horizontal zoom, reduced for long files so the strip stays a sane width. */
export function pxPerSecFor(timelineSec: number): number {
  if (timelineSec <= 0) return BASE_PX_PER_SEC;
  return Math.max(MIN_PX_PER_SEC, Math.min(BASE_PX_PER_SEC, MAX_TIMELINE_WIDTH / timelineSec));
}

const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];

/** Seconds between ruler labels, kept at roughly one label per 84 px. */
export function rulerStepFor(pxPerSec: number): number {
  const target = 84 / pxPerSec;
  return RULER_STEPS.find((step) => step >= target) ?? 600;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Maps the authored suggestion moments onto a real narration length. Pauses keep
 * their absolute length; story regions stretch with the recording.
 */
export function scaleSuggestions(narrationSec: number): Suggestion[] {
  const safe = safeNarrationSec(narrationSec);
  if (Math.abs(safe - BASE_NARRATION_SEC) < 0.05) return SUGGESTIONS;

  const ratio = safe / BASE_NARRATION_SEC;

  return SUGGESTIONS.map((suggestion) => {
    const startSec = round1(Math.min(safe, suggestion.clip.startSec * ratio));
    const clipLength =
      suggestion.kind === 'pause'
        ? suggestion.clip.endSec - suggestion.clip.startSec
        : (suggestion.clip.endSec - suggestion.clip.startSec) * ratio;

    return {
      ...suggestion,
      timeSec: round1(Math.min(safe, suggestion.timeSec * ratio)),
      clip: {
        ...suggestion.clip,
        startSec,
        endSec: round1(Math.min(safe, startSec + clipLength)),
      },
    };
  });
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Loudness envelope that follows the beats of the story, as a 0..1 progress. */
function envelopeAt(progress: number): number {
  if (progress < 0.167) return 0.34;
  if (progress < 0.214) return 0.42;
  if (progress < 0.381) return 0.52;
  if (progress < 0.548) return 0.68;
  if (progress < 0.738) return 0.92;
  if (progress < 0.905) return 0.6;
  return 0.4;
}

/**
 * Placeholder narration waveform, used when the real peaks are not available
 * (the sample project, or a platform without audio decoding). It is stretched to
 * the real narration length so it stays aligned with playback.
 */
export function buildNarrationWaveform(narrationSec: number): number[] {
  const safe = safeNarrationSec(narrationSec);
  const random = createRandom(20260912);
  const bars = Math.max(1, Math.round(safe * BARS_PER_SEC));
  const values: number[] = [];

  for (let index = 0; index < bars; index += 1) {
    const progress = index / bars;
    const syllable = 0.72 + 0.28 * Math.abs(Math.sin(index * 1.15));
    const jitter = 0.62 + 0.38 * random();
    values.push(Math.min(1, envelopeAt(progress) * syllable * jitter));
  }

  return values;
}

/** Down-samples a waveform to a fixed number of bars. */
export function resampleWaveform(source: number[], bars: number): number[] {
  if (bars <= 0) return [];
  if (source.length === 0) return Array.from({ length: bars }, () => 0.03);

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

/**
 * Fits a narration waveform into a wider strip: the recording fills
 * `filledRatio` of the bars, the rest is drawn as room tone.
 */
export function fitWaveform(source: number[], bars: number, filledRatio: number): number[] {
  if (bars <= 0) return [];
  const filled = Math.max(1, Math.min(bars, Math.round(bars * filledRatio)));
  const values = resampleWaveform(source, filled);
  while (values.length < bars) values.push(0.03);
  return values;
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
