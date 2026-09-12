/**
 * Web counterpart of `generatedAudio.ts`: decode the backend's base64 MP3 into
 * binary bytes, create an audio Blob with its real MIME type, and return its URL.
 */

import type { SavedGeneratedAudio } from '@/lib/generatedAudio';

/** Turns base64 audio into a verified playable blob URL. */
export function saveGeneratedAudio(
  base64: string,
  _fileName: string,
  mimeType: string,
  expectedByteLength: number,
): Promise<SavedGeneratedAudio> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (bytes.byteLength === 0) throw new Error('The decoded audio is empty.');
  if (bytes.byteLength !== expectedByteLength) {
    throw new Error(
      `The decoded audio has ${bytes.byteLength} bytes; expected ${expectedByteLength}.`,
    );
  }

  const blob = new Blob([bytes], { type: mimeType });
  if (blob.size !== expectedByteLength || blob.type !== mimeType) {
    throw new Error('The browser could not create a valid audio blob.');
  }

  return Promise.resolve({
    uri: URL.createObjectURL(blob),
    byteLength: blob.size,
    mimeType: blob.type,
  });
}
