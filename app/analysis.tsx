import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react-native';
import { LinkButton, Spinner, Surface, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { View } from 'react-native';

import { AnimatedView } from '@/components/ui/primitives/AnimatedView';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useStoryStore } from '@/lib/store';
import { palette } from '@/lib/theme';

const STAGES = [
  'Reading narrative structure',
  'Detecting emotional changes',
  'Analysing pacing',
  'Identifying possible pauses',
  'Finding opportunities for music and sound effects',
];

const STAGE_MS = 950;
const HANDOFF_MS = 700;

export default function AnalysisScreen() {
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const audioFileName = useStoryStore((state) => state.audioFileName);
  const completeAnalysis = useStoryStore((state) => state.completeAnalysis);

  const [completed, setCompleted] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Reanimated SharedValue.value assignment is the documented API for driving animations
    // from React state; it is intentionally mutable.
    // oxlint-disable-next-line react/immutability
    progress.value = withTiming(completed / STAGES.length, { duration: 480 });
  }, [completed, progress]);

  useEffect(() => {
    if (completed >= STAGES.length) {
      completeAnalysis();
      const timer = setTimeout(() => router.replace('/(tabs)/editor'), HANDOFF_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setCompleted((value) => value + 1), STAGE_MS);
    return () => clearTimeout(timer);
  }, [completed, completeAnalysis]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center gap-8 px-6">
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Sparkles size={16} color={palette.marker} />
            <Typography type="body-xs" className="text-marker tracking-widest uppercase">
              Analysing
            </Typography>
          </View>
          <Typography type="h2" className="text-ink">
            {manuscriptTitle ?? 'Your story'}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            {audioFileName ?? 'Narration'} · reading your manuscript alongside your narration
          </Typography>
        </View>

        <View className="bg-lane h-1.5 overflow-hidden rounded-full">
          <AnimatedView className="bg-accent h-full rounded-full" style={barStyle} />
        </View>

        <Surface className="border-border gap-4 rounded-2xl border p-5">
          {STAGES.map((stage, index) => {
            const isDone = index < completed;
            const isActive = index === completed;

            return (
              <AnimatedView
                key={stage}
                entering={FadeInDown.delay(index * 90).duration(320)}
                className="flex-row items-center gap-3"
              >
                <View className="h-6 w-6 items-center justify-center">
                  {isDone ? (
                    <Check size={18} color={palette.success} />
                  ) : isActive ? (
                    <Spinner size="sm" />
                  ) : (
                    <View className="bg-lane-line h-2 w-2 rounded-full" />
                  )}
                </View>
                <Typography
                  type="body"
                  weight={isActive ? 'semibold' : 'normal'}
                  className={isDone || isActive ? 'text-ink' : 'text-ink-soft'}
                >
                  {stage}
                </Typography>
              </AnimatedView>
            );
          })}
        </Surface>

        <View className="gap-3">
          <Typography type="body-sm" className="text-ink-soft text-center">
            Everything found here is a suggestion. You decide what stays in your story.
          </Typography>
          <LinkButton size="sm" className="self-center" onPress={() => router.back()}>
            <LinkButton.Label>Cancel analysis</LinkButton.Label>
          </LinkButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
