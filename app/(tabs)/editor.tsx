import { useCallback, useState } from 'react';
import { ChevronRight, GitCompareArrows, Sparkles } from 'lucide-react-native';
import { Button, Surface, Typography } from 'heroui-native';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { StatusPill } from '@/components/StatusPill';
import { Timeline } from '@/components/Timeline';
import { TransportControls } from '@/components/TransportControls';
import { usePlayhead } from '@/hooks/usePlayhead';
import { useStoryStore } from '@/lib/store';
import { formatTime, type Suggestion, SUGGESTIONS, TIMELINE_SEC } from '@/lib/story';
import { palette } from '@/lib/theme';

export default function EditorScreen() {
  const hasAnalysed = useStoryStore((state) => state.hasAnalysed);
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const statuses = useStoryStore((state) => state.statuses);
  const details = useStoryStore((state) => state.details);

  const { position, isPlaying, toggle, pause, seek, reset } = usePlayhead(TIMELINE_SEC);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openSuggestion = useCallback(
    (suggestion: Suggestion) => {
      pause();
      seek(suggestion.timeSec);
      setSelectedId(suggestion.id);
      router.push({ pathname: '/suggestion/[id]', params: { id: suggestion.id } });
    },
    [pause, seek],
  );

  if (!hasAnalysed) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <View className="flex-1 justify-center gap-4 px-6">
          <Typography type="h3" className="text-ink">
            No analysed story yet
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            Add a manuscript and a narration file on the Project tab, then run Analyse Story to open
            the editor.
          </Typography>
          <Button size="lg" onPress={() => router.replace('/(tabs)')}>
            <Button.Label>Go to project</Button.Label>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const decided = SUGGESTIONS.filter((item) => {
    const status = statuses[item.id];
    return status === 'accepted' || status === 'rejected';
  }).length;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            Audio editor
          </Typography>
          <Typography type="h2" className="text-ink">
            {manuscriptTitle ?? 'Your story'}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            {decided} of {SUGGESTIONS.length} suggestions decided · your narration is never changed
            without you
          </Typography>
        </View>

        <Timeline
          position={position}
          isPlaying={isPlaying}
          statuses={statuses}
          selectedId={selectedId}
          onSeek={seek}
          onSelectSuggestion={openSuggestion}
        />

        <TransportControls
          isPlaying={isPlaying}
          position={position}
          duration={TIMELINE_SEC}
          onToggle={toggle}
          onRestart={reset}
          onSeek={seek}
        />

        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Sparkles size={16} color={palette.marker} />
            <Typography type="body" weight="semibold" className="text-ink">
              AI suggestions
            </Typography>
            <Typography type="body-sm" className="text-ink-soft">
              · you decide
            </Typography>
          </View>

          <Surface className="border-border overflow-hidden rounded-2xl border">
            {SUGGESTIONS.map((suggestion, index) => (
              <Pressable
                key={suggestion.id}
                onPress={() => openSuggestion(suggestion)}
                accessibilityRole="button"
                className={index === 0 ? 'p-4' : 'border-border border-t p-4'}
              >
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row items-center gap-2">
                      <Typography type="body-sm" weight="semibold" className="text-ink">
                        {formatTime(suggestion.timeSec)}
                      </Typography>
                      <StatusPill status={statuses[suggestion.id] ?? 'pending'} />
                    </View>
                    <Typography type="body-sm" className="text-ink" numberOfLines={2}>
                      {details[suggestion.id] ?? suggestion.detail}
                    </Typography>
                  </View>
                  <ChevronRight size={18} color={palette.inkSoft} />
                </View>
              </Pressable>
            ))}
          </Surface>
        </View>

        <Button variant="secondary" size="lg" onPress={() => router.push('/(tabs)/compare')}>
          <GitCompareArrows size={18} color={palette.ink} />
          <Button.Label>Compare versions</Button.Label>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
