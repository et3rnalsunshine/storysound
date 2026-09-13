import { useCallback, useEffect, useRef, useState } from 'react';
import { Waves } from 'lucide-react-native';
import {
  PanResponder,
  type PanResponderInstance,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
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
  liveMoveUpdates?: boolean;
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
  liveMoveUpdates = false,
}: DraggableSfxClipProps) {
  const durationSec = Math.max(0.5, suggestion.clip.endSec - suggestion.clip.startSec);
  const sourceLimit = Math.max(0.5, maxDurationSec ?? durationSec);
  const gestureOriginRef = useRef({
    suggestion,
    startSec: suggestion.clip.startSec,
    durationSec,
    endSec: suggestion.clip.endSec,
    sourceLimit,
  });
  const latestRef = useRef({
    suggestion,
    narrationSec,
    pxPerSec,
    durationSec,
    sourceLimit,
    liveMoveUpdates,
    onSelect,
    onMove,
    onResize,
    onDragStateChange,
  });
  const [previewTiming, setPreviewTiming] = useState<{
    startSec: number;
    durationSec: number;
  } | null>(null);
  const [responders, setResponders] = useState<{
    body: PanResponderInstance;
    leftResize: PanResponderInstance;
    rightResize: PanResponderInstance;
  } | null>(null);
  const displayedStart = previewTiming?.startSec ?? suggestion.clip.startSec;
  const displayedDuration = previewTiming?.durationSec ?? durationSec;

  useEffect(() => {
    latestRef.current = {
      suggestion,
      narrationSec,
      pxPerSec,
      durationSec,
      sourceLimit,
      liveMoveUpdates,
      onSelect,
      onMove,
      onResize,
      onDragStateChange,
    };
  }, [
    durationSec,
    liveMoveUpdates,
    narrationSec,
    onDragStateChange,
    onMove,
    onResize,
    onSelect,
    pxPerSec,
    sourceLimit,
    suggestion,
  ]);

  const finishGesture = useCallback(() => {
    setPreviewTiming(null);
    latestRef.current.onDragStateChange?.(false);
  }, []);

  // The body and edge handles own separate responders so move and resize never compete.
  // Initialize them after mount so their stable identities survive live store-update renders.
  useEffect(() => {
    const beginGesture = () => {
      const latest = latestRef.current;
      gestureOriginRef.current = {
        suggestion: latest.suggestion,
        startSec: latest.suggestion.clip.startSec,
        durationSec: latest.durationSec,
        endSec: latest.suggestion.clip.endSec,
        sourceLimit: latest.sourceLimit,
      };
      latest.onSelect(latest.suggestion);
      latest.onDragStateChange?.(true);
    };

    setResponders({
      body: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (_event, gesture) => {
          const latest = latestRef.current;
          const origin = gestureOriginRef.current;
          const nextStart = clampStart(
            origin.startSec + gesture.dx / latest.pxPerSec,
            origin.durationSec,
            latest.narrationSec,
          );
          setPreviewTiming({ startSec: nextStart, durationSec: origin.durationSec });
          if (latest.liveMoveUpdates) latest.onMove(origin.suggestion, nextStart);
        },
        onPanResponderRelease: (_event, gesture) => {
          const latest = latestRef.current;
          const origin = gestureOriginRef.current;
          const nextStart = clampStart(
            origin.startSec + gesture.dx / latest.pxPerSec,
            origin.durationSec,
            latest.narrationSec,
          );
          latest.onMove(origin.suggestion, nextStart);
          finishGesture();
        },
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
      rightResize: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (_event, gesture) => {
          const latest = latestRef.current;
          const origin = gestureOriginRef.current;
          const maximum = Math.min(origin.sourceLimit, latest.narrationSec - origin.startSec);
          const nextDuration = roundTenth(
            Math.max(0.5, Math.min(maximum, origin.durationSec + gesture.dx / latest.pxPerSec)),
          );
          setPreviewTiming({ startSec: origin.startSec, durationSec: nextDuration });
          latest.onResize?.(origin.suggestion, origin.startSec, nextDuration);
        },
        onPanResponderRelease: finishGesture,
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
      leftResize: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (_event, gesture) => {
          const latest = latestRef.current;
          const origin = gestureOriginRef.current;
          const earliest = Math.max(0, origin.endSec - origin.sourceLimit);
          const latestStart = origin.endSec - 0.5;
          const nextStart = roundTenth(
            Math.max(
              earliest,
              Math.min(latestStart, origin.startSec + gesture.dx / latest.pxPerSec),
            ),
          );
          const nextDuration = roundTenth(origin.endSec - nextStart);
          setPreviewTiming({ startSec: nextStart, durationSec: nextDuration });
          latest.onResize?.(origin.suggestion, nextStart, nextDuration);
        },
        onPanResponderRelease: finishGesture,
        onPanResponderTerminate: finishGesture,
        onPanResponderTerminationRequest: () => false,
      }),
    });
  }, [finishGesture]);

  const width = Math.max(24, displayedDuration * pxPerSec);

  return (
    <View
      className={cn(
        'bg-sfx absolute rounded-md border',
        selected ? 'border-ink border-2' : 'border-sfx',
      )}
      style={[{ left: displayedStart * pxPerSec, width }, style]}
    >
      <View
        {...(responders?.body.panHandlers ?? {})}
        accessibilityRole="adjustable"
        accessibilityLabel={`${suggestion.clip.label}, starts at ${formatCueTime(displayedStart)}, duration ${displayedDuration.toFixed(1)} seconds`}
        className="absolute inset-0 justify-center rounded-md px-2"
      >
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
      </View>

      {selected && onResize !== undefined ? (
        <View
          {...(responders?.leftResize.panHandlers ?? {})}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize sound effect start"
          className="absolute inset-y-0 w-5 items-center justify-center"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 2 }}
          style={{ left: -10, zIndex: 2 }}
        >
          <View className="bg-panel h-6 w-1.5 rounded-full" />
        </View>
      ) : null}

      {selected && onResize !== undefined ? (
        <View
          {...(responders?.rightResize.panHandlers ?? {})}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize sound effect end"
          className="absolute inset-y-0 w-5 items-center justify-center"
          hitSlop={{ top: 6, bottom: 6, left: 2, right: 6 }}
          style={{ right: -10, zIndex: 2 }}
        >
          <View className="bg-panel h-6 w-1.5 rounded-full" />
        </View>
      ) : null}
    </View>
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
