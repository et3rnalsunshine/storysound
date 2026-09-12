import { BARS_PER_SEC } from '@/lib/story';

export type NarrationAnalysis = {
  /** Real length of the narration file in seconds. */
  durationSec: number;
  /** Measured waveform peaks, one per waveform bar. */
  peaks: number[] | null;
};

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/**
 * Decodes the narration file with the Web Audio API, which gives both the real
 * duration and the real amplitude peaks drawn on the timeline.
 */
export async function analyseNarration(uri: string): Promise<NarrationAnalysis | null> {
  const AudioContextCtor = audioContextConstructor();
  if (AudioContextCtor === null) return null;

  let context: AudioContext | null = null;

  try {
    const response = await fetch(uri);
    const encoded = await response.arrayBuffer();
    context = new AudioContextCtor();
    const decoded = await context.decodeAudioData(encoded);
    return { durationSec: decoded.duration, peaks: peaksFrom(decoded) };
  } catch {
    return null;
  } finally {
    void context?.close();
  }
}

/** One peak per waveform bar, normalised so quiet recordings still read well. */
function peaksFrom(buffer: AudioBuffer): number[] {
  const bars = Math.max(1, Math.round(buffer.duration * BARS_PER_SEC));
  const samples = buffer.getChannelData(0);
  const samplesPerBar = samples.length / bars;
  const values: number[] = [];
  let loudest = 0;

  for (let index = 0; index < bars; index += 1) {
    const from = Math.floor(index * samplesPerBar);
    const to = Math.min(samples.length, Math.floor((index + 1) * samplesPerBar));
    let peak = 0;
    for (let cursor = from; cursor < to; cursor += 1) {
      const value = Math.abs(samples[cursor] ?? 0);
      if (value > peak) peak = value;
    }
    values.push(peak);
    if (peak > loudest) loudest = peak;
  }

  const scale = loudest > 0 ? 1 / loudest : 1;
  return values.map((value) => Math.min(1, Math.max(0.02, value * scale)));
}
