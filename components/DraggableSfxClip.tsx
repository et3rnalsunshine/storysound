import { useCallback, useMemo, useRef, useState } from 'react';
import { Waves } from 'lucide-react-native';
import { PanResponder, type StyleProp, type ViewStyle, View } from 'react-native';
import { Typography } from 'heroui-native';

import { formatCueTime } from '@/lib/sfx';
import type { Suggestion } from '@/lib/story';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type DraggableSfxClipProps = {
  suggestion: Suggestion;
  narrationSec: number;
  pxPerSec: number;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  onSelect: (suggestion: Suggestion) => void;
  onMove: (suggestion: Suggestion, startSec: number) => void;
  onResize?: (suggestion: Suggestion, startSec: number, durationSec: number) => void;
  maxDurationSec?: number;
  onDragStateChange?: (dragging: boolean) => void;
};

function clampStart(startSec: number, durationSec: number, narrationSec: number): number {
  if (!Number.isFinite(startSec)) return 0;
  const latest = Math.max(0, narrationSec - Math.max(0.5, durationSec));
  return Math.round(Math.max(0, Math.min(latest, startSec)) * 10) / 10;
}

/** An accepted SFX clip. Moving and resizing only change story scheduling, never file time. */
export function DraggableSfxClip({
  suggestion,
  narrationSec,
  pxPerSec,
  selected,
  style,
  onSelect,
  onMove,
  onResize,
  maxDurationSec,
  onDragStateChange,
}: DraggableSfxClipProps) {
  const durationSec = Math.max(0.5, suggestion.clip.endSec - suggestion.clip.startSec);
  const sourceLimit = Math.max(0.5, maxDurationSec ?? durationSec);
  const resizeOriginRef = useRef({
    startSec: suggestion.clip.startSec,
    durationSec,
    endSec: suggestion.clip.endSec,
  });
  const [previewTiming, setPreviewTiming] = useState<{
    startSec: number;
    durationSec: number;
  } | null>(null);
  const displayedStart = previewTiming?.startSec ?? suggestion.clip.startSec;
  const displayedDuration = previewTiming?.durationSec ?? durationSec;

  const finishGesture = useCallback(() => {
    setPreviewTiming(null);
    onDragStateChange?.(false);
  }, [onDragStateChange]);
  const setResizeOrigin = useCallback((origin: typeof resizeOriginRef.current) => {
    resizeOriginRef.current = origin;
  }, []);
  const getResizeOrigin = useCallback(() => resizeOriginRef.current, []);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4,
    onPanResponderGrant: () => {
      onSelect(suggestion);
      onDragStateChange?.(true);
    },
    onPanResponderMove: (_event, gesture) => {
      setPreviewTiming({
        startSec: clampStart(
          suggestion.clip.startSec + gesture.dx / pxPerSec,
          durationSec,
          narrationSec,
        ),
        durationSec,
      });
    },
    onPanResponderRelease: (_event, gesture) => {
      const next = clampStart(
        suggestion.clip.startSec + gesture.dx / pxPerSec,
        durationSec,
        narrationSec,
      );
      finishGesture();
      onMove(suggestion, next);
    },
    onPanResponderTerminate: finishGesture,
    onPanResponderTerminationRequest: () => false,
  });

  // PanResponder callbacks execute after render and need a stable mutable gesture origin.
  // oxlint-disable-next-line react/refs -- the ref is only read/written by gesture callbacks
  const rightResizeResponder = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- PanResponder callbacks use the gesture origin after render
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setResizeOrigin({
            startSec: suggestion.clip.startSec,
            durationSec,
            endSec: suggestion.clip.endSec,
          });
          onSelect(suggestion);
          onDragStateChange?.(true);
        },
        onPanResponderMove: (_event, gesture) => {
          const origin = getResizeOrigin();
          const maximum = Math.min(sourceLimit, narrationSec - origin.startSec);
          const nextDuration = roundTenth(
            Math.max(0.5, Math.min(maximum, origin.durationSec + gesture.dx / pxPerSec)),
          );
          setPreviewTiming({ startSec: origin.startSec, durationSec: nextDuration });
          onResize?.(suggestion, origin.startSec, nextDuration);
        },
        onPanResponderRelease: finishGesture,
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      durationSec,
      finishGesture,
      getResizeOrigin,
      narrationSec,
      onDragStateChange,
      onResize,
      onSelect,
      pxPerSec,
      sourceLimit,
      setResizeOrigin,
      suggestion,
    ],
  );

  // oxlint-disable-next-line react/refs -- the ref is only read/written by gesture callbacks
  const leftResizeResponder = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- PanResponder callbacks use the gesture origin after render
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setResizeOrigin({
            startSec: suggestion.clip.startSec,
            durationSec,
            endSec: suggestion.clip.endSec,
          });
          onSelect(suggestion);
          onDragStateChange?.(true);
        },
        onPanResponderMove: (_event, gesture) => {
          const origin = getResizeOrigin();
          const earliest = Math.max(0, origin.endSec - sourceLimit);
          const latest = origin.endSec - 0.5;
          const nextStart = roundTenth(
            Math.max(earliest, Math.min(latest, origin.startSec + gesture.dx / pxPerSec)),
          );
          const nextDuration = roundTenth(origin.endSec - nextStart);
          setPreviewTiming({ startSec: nextStart, durationSec: nextDuration });
          onResize?.(suggestion, nextStart, nextDuration);
        },
        onPanResponderRelease: finishGesture,
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      durationSec,
      finishGesture,
      getResizeOrigin,
      onDragStateChange,
      onResize,
      onSelect,
      pxPerSec,
      sourceLimit,
      setResizeOrigin,
      suggestion,
    ],
  );

  const width = Math.max(24, displayedDuration * pxPerSec);

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={`${suggestion.clip.label}, starts at ${formatCueTime(displayedStart)}, duration ${displayedDuration.toFixed(1)} seconds`}
      className={cn(
        'bg-sfx absolute justify-center rounded-md border px-2',
        selected ? 'border-ink border-2' : 'border-sfx',
      )}
      style={[{ left: displayedStart * pxPerSec, width }, style]}
      onTouchEnd={() => onSelect(suggestion)}
    >
      {selected && onResize !== undefined ? (
        <View
          {...leftResizeResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize sound effect start"
          className="absolute inset-y-0 w-4 items-center justify-center"
          style={{ left: -8 }}
        >
          <View className="bg-panel h-6 w-1 rounded-full" />
        </View>
      ) : null}

      <View className="flex-row items-center gap-1">
        <Waves size={11} color={palette.paper} />
        <Typography
          type="body-xs"
          weight="semibold"
          className="text-panel flex-1"
          numberOfLines={1}
        >
          {suggestion.clip.label}
        </Typography>
      </View>
      <Typography type="body-xs" className="text-panel/90" style={{ fontSize: 10 }}>
        {formatCueTime(displayedStart)}
      </Typography>

      {selected && onResize !== undefined ? (
        <View
          {...rightResizeResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize sound effect end"
          className="absolute inset-y-0 w-4 items-center justify-center"
          style={{ right: -8 }}
        >
          <View className="bg-panel h-6 w-1 rounded-full" />
        </View>
      ) : null}
    </View>
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
