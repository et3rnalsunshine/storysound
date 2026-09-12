/**
 * Web counterpart of `generatedAudio.ts`: the generated audio becomes an
 * in-memory blob URL, which expo-audio can play on the web like any other URI.
 */

/** Turns base64 audio into a playable blob URL. */
export function saveGeneratedAudio(
  base64: string,
  _fileName: string,
  mimeType: string,
): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return Promise.resolve(URL.createObjectURL(blob));
}
