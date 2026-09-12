import { useCallback, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { Button, Typography } from 'heroui-native';
import { Pressable, View } from 'react-native';

import { formatTime } from '@/lib/story';
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

/** Play / restart controls with a tappable progress bar. */
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
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  const handleScrub = useCallback(
    (locationX: number) => {
      if (!onSeek || trackWidth <= 0) return;
      onSeek((locationX / trackWidth) * duration);
    },
    [onSeek, trackWidth, duration],
  );

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
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            onPress={(event) => handleScrub(event.nativeEvent.locationX)}
            className="justify-center py-2"
          >
            <View className="bg-lane h-2 overflow-hidden rounded-full">
              <View
                className={cn('h-full rounded-full', progressClassName)}
                style={{ width: `${ratio * 100}%` }}
              />
            </View>
          </Pressable>

          <View className="flex-row justify-between">
            <Typography type="body-xs" className="text-ink-soft">
              {formatTime(position)}
            </Typography>
            <Typography type="body-xs" className="text-ink-soft">
              {formatTime(duration)}
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
    </View>
  );
}
