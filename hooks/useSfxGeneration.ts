import { useCallback } from 'react';

import { type SfxSettings, soundNameFromPrompt } from '@/lib/sfx';
import { generateSoundEffect, SfxGenerationError } from '@/lib/sfxGeneration';
import { useStoryStore } from '@/lib/store';

export type SfxGenerationRequest = {
  /** Description sent to the generator. */
  prompt: string;
  durationSec: number;
  /** Other settings to save alongside the generated sound, e.g. start or volume. */
  patch?: Partial<SfxSettings>;
};

export type SfxGeneration = {
  isGenerating: boolean;
  error: { message: string; retryable: boolean } | null;
  generate: (request: SfxGenerationRequest) => void;
  dismissError: () => void;
};

const UNEXPECTED_MESSAGE = 'Something went wrong while generating the sound.';

/**
 * Generates a sound effect for one suggestion and files it in the sound library.
 * Generation state lives in the store, so leaving the card and coming back shows
 * the same progress or error. A failure never touches narration playback.
 */
export function useSfxGeneration(suggestionId: string): SfxGeneration {
  const job = useStoryStore((state) => state.sfxJobs[suggestionId]);
  const startSfxJob = useStoryStore((state) => state.startSfxJob);
  const failSfxJob = useStoryStore((state) => state.failSfxJob);
  const clearSfxJob = useStoryStore((state) => state.clearSfxJob);
  const attachGeneratedSound = useStoryStore((state) => state.attachGeneratedSound);

  const generate = useCallback(
    ({ prompt, durationSec, patch }: SfxGenerationRequest) => {
      const description = prompt.trim();
      startSfxJob(suggestionId);

      void (async () => {
        try {
          const file = await generateSoundEffect({ prompt: description, durationSec });

          attachGeneratedSound(
            suggestionId,
            {
              name: soundNameFromPrompt(description),
              fileName: file.fileName,
              uri: file.uri,
              sizeLabel: file.sizeLabel,
              byteLength: file.byteLength,
              mimeType: file.mimeType,
              source: 'generated',
              prompt: description,
              sourceDurationSec: durationSec,
            },
            { ...patch, prompt: description },
          );
          clearSfxJob(suggestionId);
        } catch (error) {
          const failure = error instanceof SfxGenerationError ? error : null;
          failSfxJob(
            suggestionId,
            failure?.message ?? UNEXPECTED_MESSAGE,
            failure?.retryable ?? true,
          );
        }
      })();
    },
    [attachGeneratedSound, clearSfxJob, failSfxJob, startSfxJob, suggestionId],
  );

  const dismissError = useCallback(() => clearSfxJob(suggestionId), [clearSfxJob, suggestionId]);

  return {
    isGenerating: job?.state === 'generating',
    error: job?.state === 'error' ? { message: job.message, retryable: job.retryable } : null,
    generate,
    dismissError,
  };
}
