import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 60;

export type Playhead = {
  /** Current position in seconds. */
  position: number;
  isPlaying: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  reset: () => void;
};

/**
 * Timer-driven transport, used for the sample project, which has no audio file
 * on the device. Real narration files are played by `useNarrationPlayer`.
 */
export function usePlayhead(durationSec: number): Playhead {
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const positionRef = useRef(0);

  const apply = useCallback(
    (seconds: number) => {
      const clamped = Math.min(durationSec, Math.max(0, seconds));
      positionRef.current = clamped;
      setPosition(clamped);
    },
    [durationSec],
  );

  useEffect(() => {
    if (!isPlaying) return undefined;

    const startPosition = positionRef.current >= durationSec ? 0 : positionRef.current;
    const startedAt = Date.now();
    if (positionRef.current >= durationSec) apply(0);

    const interval = setInterval(() => {
      const next = startPosition + (Date.now() - startedAt) / 1000;
      if (next >= durationSec) {
        apply(durationSec);
        setIsPlaying(false);
        return;
      }
      apply(next);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isPlaying, durationSec, apply]);

  const toggle = useCallback(() => setIsPlaying((value) => !value), []);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const seek = useCallback(
    (seconds: number) => {
      apply(seconds);
    },
    [apply],
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    apply(0);
  }, [apply]);

  return { position, isPlaying, toggle, play, pause, seek, reset };
}
