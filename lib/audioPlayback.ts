import type { AudioPlayer } from 'expo-audio';

/**
 * expo-audio exposes volume as a settable property on the player. Keeping the
 * write here means the playback hook only ever hands the level over, and the
 * narration itself is never altered — only how loud it is played.
 */
export function setPlayerVolume(player: AudioPlayer, volume: number): void {
  const next = Math.max(0, Math.min(1, volume));
  if (Math.abs(player.volume - next) < 0.01) return;
  player.volume = next;
}
