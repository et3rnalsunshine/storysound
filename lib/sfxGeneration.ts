/**
 * Sound-effect generation, from the app's side.
 *
 * The ElevenLabs key never reaches the client: the app posts a description and a
 * length to the `generate-sfx` backend function, which holds the key, and gets
 * the audio back as base64. Here that audio is saved locally and handed to the
 * sound library, so a generated effect behaves exactly like an uploaded file.
 */

import { FunctionsHttpError } from '@biltme/backend';

import { bilt } from '@/lib/bilt';
import { saveGeneratedAudio } from '@/lib/generatedAudio';
import { MAX_SFX_PROMPT_LENGTH } from '@/lib/sfx';
import { formatFileSize } from '@/lib/story';

const FUNCTION_NAME = 'generate-sfx';

const UNREACHABLE_MESSAGE =
  'Could not reach the sound generator. Check your connection and try again.';

/** A generation failure the card can show, with whether retrying is worth it. */
export class SfxGenerationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'SfxGenerationError';
    this.retryable = retryable;
  }
}

export type GeneratedSoundFile = {
  /** Playable URI of the saved audio. */
  uri: string;
  fileName: string;
  sizeLabel: string | null;
  byteLength: number;
  mimeType: string;
};

type GenerateResponse = {
  audioBase64?: unknown;
  mimeType?: unknown;
  extension?: unknown;
  byteLength?: unknown;
};

function fileSlug(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 32);
  return base.length > 0 ? base : 'sound';
}

/** Reads the plain-language message the backend function sends on failure. */
async function readFailure(error: unknown): Promise<SfxGenerationError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (body !== null && typeof body === 'object' && 'error' in body) {
        const message = body.error;
        if (typeof message === 'string' && message.length > 0) {
          const retryable = 'retryable' in body ? body.retryable === true : false;
          return new SfxGenerationError(message, retryable);
        }
      }
    } catch {
      // The response was not the JSON we send; fall back to the generic message.
    }
  }
  return new SfxGenerationError(UNREACHABLE_MESSAGE, true);
}

/** Generates one sound effect and saves it on the device. */
export async function generateSoundEffect(request: {
  prompt: string;
  durationSec: number;
}): Promise<GeneratedSoundFile> {
  const prompt = request.prompt.trim().slice(0, MAX_SFX_PROMPT_LENGTH);

  let data: GenerateResponse | null;
  try {
    const response = await bilt.functions.invoke<GenerateResponse>(FUNCTION_NAME, {
      body: { prompt, durationSec: request.durationSec },
    });
    if (response.error !== null) throw await readFailure(response.error);
    data = response.data;
  } catch (error) {
    if (error instanceof SfxGenerationError) throw error;
    throw new SfxGenerationError(UNREACHABLE_MESSAGE, true);
  }

  const audioBase64 =
    typeof data?.audioBase64 === 'string' ? data.audioBase64.replaceAll(/\s/g, '') : '';
  if (audioBase64.length === 0) {
    throw new SfxGenerationError('The generator returned no audio. Try again.', true);
  }
  if (audioBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)) {
    throw new SfxGenerationError('The generator returned invalid audio data. Try again.', true);
  }

  const extension = typeof data?.extension === 'string' ? data.extension : 'mp3';
  const mimeType = typeof data?.mimeType === 'string' ? data.mimeType.toLowerCase() : '';
  const byteLength = typeof data?.byteLength === 'number' ? data.byteLength : 0;
  const padding = audioBase64.endsWith('==') ? 2 : audioBase64.endsWith('=') ? 1 : 0;
  const decodedByteLength = (audioBase64.length / 4) * 3 - padding;
  if (!mimeType.startsWith('audio/') || byteLength <= 0 || decodedByteLength !== byteLength) {
    throw new SfxGenerationError('The generator returned incomplete audio data. Try again.', true);
  }
  const fileName = `${fileSlug(prompt)}-${Date.now().toString(36)}.${extension}`;

  try {
    const saved = await saveGeneratedAudio(audioBase64, fileName, mimeType, byteLength);
    return {
      uri: saved.uri,
      fileName,
      sizeLabel: formatFileSize(saved.byteLength),
      byteLength: saved.byteLength,
      mimeType: saved.mimeType,
    };
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new SfxGenerationError(
      `Could not save the generated sound on this device.${detail}`,
      true,
    );
  }
}
