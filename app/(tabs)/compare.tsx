import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Mic, Sparkles } from 'lucide-react-native';
import { Button, Surface, Typography } from 'heroui-native';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { TransportControls } from '@/components/TransportControls';
import { Waveform } from '@/components/Waveform';
import { usePlayhead } from '@/hooks/usePlayhead';
import { useStoryStore } from '@/lib/store';
import {
  BAR_GAP,
  BAR_WIDTH,
  formatTime,
  NARRATION_WAVEFORM,
  resampleWaveform,
  type Suggestion,
  SUGGESTIONS,
  TIMELINE_SEC,
  TRACK_NAME,
} from '@/lib/story';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

const CLIP_COLOR = {
  narration: 'bg-narration',
  music: 'bg-music',
  sfx: 'bg-sfx',
} as const;

export default function CompareScreen() {
  const hasAnalysed = useStoryStore((state) => state.hasAnalysed);
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const statuses = useStoryStore((state) => state.statuses);
  const details = useStoryStore((state) => state.details);

  const original = usePlayhead(TIMELINE_SEC);
  const assisted = usePlayhead(TIMELINE_SEC);
  const [waveWidth, setWaveWidth] = useState(0);
  const barCount = Math.max(24, Math.floor(waveWidth / (BAR_WIDTH + BAR_GAP)) || 60);

  const accepted = useMemo(
    () => SUGGESTIONS.filter((item) => statuses[item.id] === 'accepted'),
    [statuses],
  );

  const originalBars = useMemo(() => resampleWaveform(NARRATION_WAVEFORM, barCount), [barCount]);
  const assistedBars = useMemo(
    () => applyAccepted(originalBars, accepted),
    [originalBars, accepted],
  );

  if (!hasAnalysed) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <View className="flex-1 justify-center gap-4 px-6">
          <Typography type="h3" className="text-ink">
            Nothing to compare yet
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            Run Analyse Story on the Project tab first. You can then hear your original narration
            next to the version with your accepted suggestions.
          </Typography>
          <Button size="lg" onPress={() => router.replace('/(tabs)')}>
            <Button.Label>Go to project</Button.Label>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const playOriginal = () => {
    assisted.pause();
    original.toggle();
  };

  const playAssisted = () => {
    original.pause();
    assisted.toggle();
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            Compare
          </Typography>
          <Typography type="h2" className="text-ink">
            {manuscriptTitle ?? 'Your story'}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            Your voice is untouched in both versions. Only the suggestions you accepted appear in
            the AI-assisted version.
          </Typography>
        </View>

        <Surface className="border-border gap-4 rounded-2xl border p-5">
          <View className="flex-row items-center gap-2">
            <Mic size={16} color={palette.narration} />
            <Typography type="body" weight="semibold" className="text-ink">
              Original narration
            </Typography>
          </View>
          <View
            className="bg-canvas rounded-xl px-3 py-4"
            onLayout={(event) => setWaveWidth(event.nativeEvent.layout.width - 24)}
          >
            <Waveform values={originalBars} height={54} barClassName="bg-narration-soft" />
          </View>
          <TransportControls
            isPlaying={original.isPlaying}
            position={original.position}
            duration={TIMELINE_SEC}
            onToggle={playOriginal}
            onRestart={original.reset}
            onSeek={original.seek}
            progressClassName="bg-narration"
          />
        </Surface>

        <Surface className="border-border gap-4 rounded-2xl border p-5">
          <View className="flex-row items-center gap-2">
            <Sparkles size={16} color={palette.marker} />
            <Typography type="body" weight="semibold" className="text-ink">
              AI-assisted version
            </Typography>
          </View>

          <View className="bg-canvas gap-2 rounded-xl px-3 py-4">
            <Waveform values={assistedBars} height={54} barClassName="bg-narration" />
            <View
              className="bg-lane h-4 overflow-hidden rounded-md"
              style={{ width: barCount * (BAR_WIDTH + BAR_GAP) }}
            >
              {accepted
                .filter((item) => item.clip.track !== 'narration')
                .map((item) => (
                  <View
                    key={item.id}
                    className={cn('absolute h-full rounded-md', CLIP_COLOR[item.clip.track])}
                    style={{
                      left: `${(item.clip.startSec / TIMELINE_SEC) * 100}%`,
                      width: `${((item.clip.endSec - item.clip.startSec) / TIMELINE_SEC) * 100}%`,
                    }}
                  />
                ))}
            </View>
          </View>

          <TransportControls
            isPlaying={assisted.isPlaying}
            position={assisted.position}
            duration={TIMELINE_SEC}
            onToggle={playAssisted}
            onRestart={assisted.reset}
            onSeek={assisted.seek}
          />
        </Surface>

        <View className="gap-3">
          <Typography type="body" weight="semibold" className="text-ink">
            In this version
          </Typography>

          {accepted.length === 0 ? (
            <Surface variant="secondary" className="border-border rounded-2xl border p-4">
              <Typography type="body-sm" className="text-ink-soft">
                You have not accepted any suggestions yet, so the AI-assisted version is identical
                to your original narration.
              </Typography>
            </Surface>
          ) : (
            <Surface variant="secondary" className="border-border gap-3 rounded-2xl border p-4">
              {accepted.map((item) => (
                <View key={item.id} className="flex-row gap-3">
                  <Check size={16} color={palette.success} />
                  <View className="flex-1 gap-0.5">
                    <Typography type="body-sm" weight="semibold" className="text-ink">
                      {formatTime(item.timeSec)} · {TRACK_NAME[item.clip.track]}
                    </Typography>
                    <Typography type="body-sm" className="text-ink-soft">
                      {details[item.id] ?? item.detail}
                    </Typography>
                  </View>
                </View>
              ))}
            </Surface>
          )}
        </View>

        <Button
          size="lg"
          onPress={() => {
            original.pause();
            assisted.pause();
            router.navigate('/(tabs)/editor');
          }}
        >
          <ArrowLeft size={18} color={palette.paper} />
          <Button.Label>Return to Editor</Button.Label>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Reflects accepted suggestions in the compared waveform. */
function applyAccepted(bars: number[], accepted: Suggestion[]): number[] {
  const secPerBar = TIMELINE_SEC / bars.length;

  return bars.map((value, index) => {
    const seconds = index * secPerBar;
    let next = value;

    for (const suggestion of accepted) {
      const { clip, kind } = suggestion;
      const inRange = seconds >= clip.startSec && seconds <= clip.endSec;
      if (!inRange) continue;
      if (kind === 'pause') next = 0.04;
      else if (kind === 'intensity') next = Math.min(1, next * 1.12);
      else if (kind === 'mix') next = Math.min(1, next * 1.08);
    }

    return next;
  });
}
