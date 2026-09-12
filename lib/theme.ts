/**
 * Hex mirrors of the StorySound palette declared in global.css.
 *
 * Use className tokens (bg-narration, text-ink, ...) for styling. These hex
 * values exist for props that React Native must parse itself: icon colors,
 * navigation tints, status bar and native modal backgrounds.
 */
export const palette = {
  paper: '#F7F3ED',
  panel: '#FCFAF7',
  canvas: '#F1EBE2',
  lane: '#E6DED2',
  laneLine: '#D8CEBE',
  border: '#E2D9CC',
  ink: '#2A2521',
  inkSoft: '#6E645A',
  narration: '#3D5A80',
  narrationSoft: '#A8BBD0',
  music: '#2E7D74',
  musicSoft: '#A6CBC6',
  sfx: '#B5762F',
  sfxSoft: '#E4C79C',
  marker: '#B4552B',
  success: '#3F7D4E',
} as const;
