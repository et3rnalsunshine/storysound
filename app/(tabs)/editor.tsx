import { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioLines, ChevronRight, GitCompareArrows, Sparkles } from 'lucide-react-native';
import { Button, Spinner, Surface, Typography } from 'heroui-native';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { StatusPill } from '@/components/StatusPill';
import { Timeline } from '@/components/Timeline';
import { TransportControls } from '@/components/TransportControls';
import { useAssistedMix } from '@/hooks/useAssistedMix';
import { useNarrationPlayer } from '@/hooks/useNarrationPlayer';
import { useStoryTimeline } from '@/hooks/useStoryTimeline';
import { useStoryStore } from '@/lib/store';
import { formatTime, type Suggestion } from '@/lib/story';
import { palette } from '@/lib/theme';

export default function EditorScreen() {
  const hasAnalysed = useStoryStore((state) => state.hasAnalysed);
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const audioFileName = useStoryStore((state) => state.audioFileName);
  const statuses = useStoryStore((state) => state.statuses);
  const details = useStoryStore((state) => state.details);
  const setNarrationDuration = useStoryStore((state) => state.setNarrationDuration);

  const {
    audioUri,
    narrationSec,
    timelineSec,
    pxPerSec,
    suggestions,
    waveform,
    hasMeasuredWaveform,
  } = useStoryTimeline();

  const player = useNarrationPlayer(audioUri, narrationSec);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { measuredDurationSec } = player;
  useEffect(() => {
    if (measuredDurationSec !== null) setNarrationDuration(measuredDurationSec);
  }, [measuredDurationSec, setNarrationDuration]);

  const accepted = useMemo(
    () => suggestions.filter((item) => statuses[item.id] === 'accepted'),
    [statuses, suggestions],
  );

  useAssistedMix({
    accepted,
    enabled: accepted.length > 0,
    position: player.position,
    isPlaying: player.isPlaying,
    setVolume: player.setVolume,
    pause: player.pause,
    play: player.play,
  });

  const { pause, seek } = player;
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

  const decided = suggestions.filter((item) => {
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
            {decided} of {suggestions.length} suggestions decided · your narration is never changed
            without you
          </Typography>
        </View>

        <Timeline
          position={player.position}
          isPlaying={player.isPlaying}
          suggestions={suggestions}
          waveform={waveform}
          narrationSec={narrationSec}
          timelineSec={timelineSec}
          pxPerSec={pxPerSec}
          statuses={statuses}
          selectedId={selectedId}
          onSeek={player.seek}
          onSelectSuggestion={openSuggestion}
        />

        <View className="gap-3">
          <TransportControls
            isPlaying={player.isPlaying}
            position={player.position}
            duration={player.durationSec}
            onToggle={player.toggle}
            onRestart={player.reset}
            onSeek={player.seek}
          />

          <View className="flex-row items-center gap-2">
            {player.isLoading ? (
              <Spinner size="sm" />
            ) : (
              <AudioLines size={14} color={palette.sfx} />
            )}
            <Typography type="body-xs" className="text-ink-soft flex-1" numberOfLines={2}>
              {playbackNote({
                fileName: audioFileName,
                isSimulated: player.isSimulated,
                isLoading: player.isLoading,
                hasError: player.error !== null,
                narrationSec,
                hasMeasuredWaveform,
                hasAccepted: accepted.length > 0,
              })}
            </Typography>
          </View>
        </View>

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
            {suggestions.map((suggestion, index) => (
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

type PlaybackNoteOptions = {
  fileName: string | null;
  isSimulated: boolean;
  isLoading: boolean;
  hasError: boolean;
  narrationSec: number;
  hasMeasuredWaveform: boolean;
  hasAccepted: boolean;
};

/** Plain-language note about what the transport is actually playing. */
function playbackNote({
  fileName,
  isSimulated,
  isLoading,
  hasError,
  narrationSec,
  hasMeasuredWaveform,
  hasAccepted,
}: PlaybackNoteOptions): string {
  if (hasError) {
    return 'This audio file could not be played. Pick another recording on the Project tab (m4a, mp3 or wav).';
  }
  if (isLoading) return 'Loading your narration…';
  if (isSimulated) {
    return `Sample project · timeline preview at ${formatTime(narrationSec)}, no audio file on this device.`;
  }

  const source = hasMeasuredWaveform
    ? 'waveform read from your file'
    : 'waveform matched to your file length';
  const mix = hasAccepted ? ' · accepted suggestions are applied while playing' : '';
  return `Playing ${fileName ?? 'your narration'} · ${formatTime(narrationSec)} · ${source}${mix}`;
}
