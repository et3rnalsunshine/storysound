import { useCallback, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  RotateCcw as SkipBack,
  RotateCw as SkipForward,
} from 'lucide-react-native';
import { Button, Typography } from 'heroui-native';
import { View } from 'react-native';

import { formatCueTime } from '@/lib/sfx';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type TransportControlsProps = {
  isPlaying: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onRestart: () => void;
  onSeek?: (seconds: number) => void;
  /** Optional caption above the scrubber, e.g. the version being played. */
  label?: string;
  progressClassName?: string;
};

/** Play controls with tap/drag scrubbing and short skip actions. */
export function TransportControls({
  isPlaying,
  position,
  duration,
  onToggle,
  onRestart,
  onSeek,
  label,
  progressClassName = 'bg-accent',
}: TransportControlsProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safePosition = Number.isFinite(position)
    ? Math.max(0, Math.min(safeDuration, position))
    : 0;
  const ratio = safeDuration > 0 ? safePosition / safeDuration : 0;

  const handleScrub = useCallback(
    (locationX: number) => {
      if (!onSeek || trackWidth <= 0 || !Number.isFinite(locationX)) return;
      const next = (Math.max(0, Math.min(trackWidth, locationX)) / trackWidth) * safeDuration;
      if (Number.isFinite(next)) onSeek(next);
    },
    [onSeek, safeDuration, trackWidth],
  );

  const skip = (delta: number) => {
    if (!onSeek) return;
    onSeek(Math.max(0, Math.min(safeDuration, safePosition + delta)));
  };

  return (
    <View className="gap-3">
      {label ? (
        <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
          {label}
        </Typography>
      ) : null}

      <View className="flex-row items-center gap-4">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full"
          onPress={onToggle}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause color={palette.paper} size={22} fill={palette.paper} />
          ) : (
            <Play color={palette.paper} size={22} fill={palette.paper} />
          )}
        </Button>

        <View className="flex-1 gap-2">
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Narration position"
            accessibilityValue={{ min: 0, max: safeDuration, now: safePosition }}
            accessibilityActions={[
              { name: 'decrement', label: 'Back 5 seconds' },
              { name: 'increment', label: 'Forward 5 seconds' },
            ]}
            onAccessibilityAction={(event) =>
              skip(event.nativeEvent.actionName === 'decrement' ? -5 : 5)
            }
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => onSeek !== undefined}
            onMoveShouldSetResponder={() => onSeek !== undefined}
            onResponderGrant={(event) => handleScrub(event.nativeEvent.locationX)}
            onResponderMove={(event) => handleScrub(event.nativeEvent.locationX)}
            className="justify-center py-3"
          >
            <View className="bg-lane h-2 overflow-visible rounded-full">
              <View
                className={cn('h-full rounded-full', progressClassName)}
                style={{ width: `${ratio * 100}%` }}
              />
              <View
                pointerEvents="none"
                className="border-panel bg-accent absolute top-1/2 h-4 w-4 rounded-full border-2"
                style={{
                  left: `${ratio * 100}%`,
                  transform: [{ translateX: -8 }, { translateY: -8 }],
                }}
              />
            </View>
          </View>

          <View className="flex-row justify-between">
            <Typography type="body-xs" className="text-ink-soft">
              {formatCueTime(safePosition)}
            </Typography>
            <Typography type="body-xs" className="text-ink-soft">
              {formatCueTime(safeDuration)}
            </Typography>
          </View>
        </View>

        <Button
          size="lg"
          variant="tertiary"
          className="h-12 w-12 rounded-full"
          onPress={onRestart}
          accessibilityLabel="Back to start"
        >
          <RotateCcw color={palette.ink} size={18} />
        </Button>
      </View>

      <View className="flex-row justify-center gap-2">
        <Button size="sm" variant="secondary" onPress={() => skip(-5)} isDisabled={!onSeek}>
          <SkipBack color={palette.ink} size={15} />
          <Button.Label>-5 sec</Button.Label>
        </Button>
        <Button size="sm" variant="secondary" onPress={() => skip(5)} isDisabled={!onSeek}>
          <SkipForward color={palette.ink} size={15} />
          <Button.Label>+5 sec</Button.Label>
        </Button>
      </View>
    </View>
  );
}
