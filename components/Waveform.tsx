import { View } from 'react-native';

import { BAR_GAP, BAR_WIDTH } from '@/lib/story';
import { cn } from '@/lib/utils';

type WaveformProps = {
  /** Normalised amplitudes, 0..1. */
  values: number[];
  height: number;
  /** Tailwind background class for each bar. */
  barClassName?: string;
  barWidth?: number;
  barGap?: number;
  className?: string;
};

/** Static bar-style waveform rendering. */
export function Waveform({
  values,
  height,
  barClassName = 'bg-narration',
  barWidth = BAR_WIDTH,
  barGap = BAR_GAP,
  className,
}: WaveformProps) {
  return (
    <View className={cn('flex-row items-center', className)} style={{ height }}>
      {values.map((value, index) => (
        <View
          // Bars are a static, non-reorderable amplitude list re-rendered as a whole array
          // (no insertions/removals within a given values array), so an index key is safe here;
          // amplitudes are plain numbers with no inherent unique id to key on instead.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          className={cn('rounded-full', barClassName)}
          style={{
            width: barWidth,
            height: Math.max(2, value * height),
            marginRight: barGap,
          }}
        />
      ))}
    </View>
  );
}
