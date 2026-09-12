/**
 * Saves generated sound-effect audio on the device so it can be played back.
 *
 * The backend returns the audio as base64. On native it is written into the app
 * cache and the file URI is handed to expo-audio; the web build has its own
 * implementation in `generatedAudio.web.ts`.
 */

import { Directory, File, Paths } from 'expo-file-system';

const FOLDER = 'storysound-sfx';

/** Writes base64 audio into the cache and returns a playable file URI. */
export function saveGeneratedAudio(
  base64: string,
  fileName: string,
  _mimeType: string,
): Promise<string> {
  const directory = new Directory(Paths.cache, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });

  const file = new File(directory, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  return Promise.resolve(file.uri);
}
