/**
 * Saves generated sound-effect audio on the device so it can be played back.
 *
 * The backend returns the audio as base64. On native it is decoded by Expo FileSystem
 * into the app cache and the verified file URI is handed to expo-audio; the web build
 * has its own implementation in `generatedAudio.web.ts`.
 */

import { Directory, File, Paths } from 'expo-file-system';

const FOLDER = 'storysound-sfx';

export type SavedGeneratedAudio = {
  uri: string;
  byteLength: number;
  mimeType: string;
};

/** Writes base64 audio into the cache and returns a verified playable file URI. */
export function saveGeneratedAudio(
  base64: string,
  fileName: string,
  mimeType: string,
  expectedByteLength: number,
): Promise<SavedGeneratedAudio> {
  const directory = new Directory(Paths.cache, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });

  const file = new File(directory, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  const actualByteLength = file.size;
  if (!file.exists || actualByteLength <= 0) {
    throw new Error('The decoded audio file is empty.');
  }
  if (actualByteLength !== expectedByteLength) {
    file.delete();
    throw new Error(
      `The decoded audio file has ${actualByteLength} bytes; expected ${expectedByteLength}.`,
    );
  }

  return Promise.resolve({ uri: file.uri, byteLength: actualByteLength, mimeType });
}
