import { useState } from 'react';
import { PanResponder, type StyleProp, type ViewStyle, View } from 'react-native';
import { Typography } from 'heroui-native';

import { formatCueTime } from '@/lib/sfx';
import type { Suggestion } from '@/lib/story';
import { cn } from '@/lib/utils';

type DraggableSfxClipProps = {
  suggestion: Suggestion;
  narrationSec: number;
  pxPerSec: number;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  onSelect: (suggestion: Suggestion) => void;
  onMove: (suggestion: Suggestion, startSec: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

function clampStart(startSec: number, durationSec: number, narrationSec: number): number {
  if (!Number.isFinite(startSec)) return 0;
  const latest = Math.max(0, narrationSec - Math.max(0.5, durationSec));
  return Math.round(Math.max(0, Math.min(latest, startSec)) * 10) / 10;
}

/** An accepted SFX clip. Dragging changes story time only; it never seeks the sound file. */
export function DraggableSfxClip({
  suggestion,
  narrationSec,
  pxPerSec,
  selected,
  style,
  onSelect,
  onMove,
  onDragStateChange,
}: DraggableSfxClipProps) {
  const durationSec = Math.max(0.5, suggestion.clip.endSec - suggestion.clip.startSec);
  const [previewStart, setPreviewStart] = useState<number | null>(null);
  const displayedStart = previewStart ?? suggestion.clip.startSec;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4,
    onPanResponderGrant: () => {
      onSelect(suggestion);
      onDragStateChange?.(true);
    },
    onPanResponderMove: (_event, gesture) => {
      setPreviewStart(
        clampStart(suggestion.clip.startSec + gesture.dx / pxPerSec, durationSec, narrationSec),
      );
    },
    onPanResponderRelease: (_event, gesture) => {
      const next = clampStart(
        suggestion.clip.startSec + gesture.dx / pxPerSec,
        durationSec,
        narrationSec,
      );
      setPreviewStart(null);
      onDragStateChange?.(false);
      onMove(suggestion, next);
    },
    onPanResponderTerminate: () => {
      setPreviewStart(null);
      onDragStateChange?.(false);
    },
    onPanResponderTerminationRequest: () => false,
  });

  const width = Math.max(96, durationSec * pxPerSec);

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={`${suggestion.clip.label}, starts at ${formatCueTime(displayedStart)}`}
      className={cn(
        'bg-sfx absolute justify-center rounded-md border px-2',
        selected ? 'border-ink border-2' : 'border-sfx',
      )}
      style={[{ left: displayedStart * pxPerSec, width }, style]}
      onTouchEnd={() => onSelect(suggestion)}
    >
      <Typography type="body-xs" weight="semibold" className="text-panel" numberOfLines={1}>
        {suggestion.clip.label}
      </Typography>
      <Typography type="body-xs" className="text-panel/90" style={{ fontSize: 10 }}>
        {formatCueTime(displayedStart)}
      </Typography>
    </View>
  );
}
