import { createAudioPlayer } from 'expo-audio';

export type NarrationAnalysis = {
  /** Real length of the narration file in seconds. */
  durationSec: number;
  /**
   * Measured waveform peaks. `null` on native, where the platform offers no
   * audio decoding API — the timeline falls back to a generated waveform that is
   * stretched to the real duration.
   */
  peaks: number[] | null;
};

const PROBE_TIMEOUT_MS = 8000;

/**
 * Reads the real length of a narration file by loading it into an audio player
 * and waiting for the first status that reports a duration.
 */
export async function analyseNarration(uri: string): Promise<NarrationAnalysis | null> {
  const player = createAudioPlayer({ uri });

  try {
    const durationSec = await new Promise<number>((resolve, reject) => {
      let subscription: { remove: () => void } | null = null;

      const timer = setTimeout(() => {
        subscription?.remove();
        reject(new Error('Timed out while reading the narration file.'));
      }, PROBE_TIMEOUT_MS);

      const settle = (duration: number) => {
        clearTimeout(timer);
        subscription?.remove();
        resolve(duration);
      };

      subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.error !== null && status.error !== undefined) {
          clearTimeout(timer);
          subscription?.remove();
          reject(new Error(status.error));
          return;
        }
        if (status.isLoaded && status.duration > 0) settle(status.duration);
      });

      if (player.isLoaded && player.duration > 0) settle(player.duration);
    });

    return { durationSec, peaks: null };
  } catch {
    return null;
  } finally {
    player.remove();
  }
}
