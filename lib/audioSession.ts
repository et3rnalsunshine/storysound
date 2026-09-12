import { setAudioModeAsync } from 'expo-audio';

let configured = false;

/**
 * Configures the audio session once, so narration and sound effects are audible
 * even when the device is on silent. Safe to call from any player.
 */
export function ensureAudioSession(): void {
  if (configured) return;
  configured = true;
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
}
