import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, ChevronRight, GitCompareArrows, Sparkles, Waves } from 'lucide-react-native';
import { Button, Spinner, Surface, Typography } from 'heroui-native';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { SfxTimingPanel } from '@/components/SfxTimingPanel';
import { StatusPill } from '@/components/StatusPill';
import { Timeline } from '@/components/Timeline';
import { TransportControls } from '@/components/TransportControls';
import { useAssistedMix } from '@/hooks/useAssistedMix';
import { useNarrationPlayer } from '@/hooks/useNarrationPlayer';
import { useSfxScheduler } from '@/hooks/useSfxScheduler';
import { useStoryTimeline } from '@/hooks/useStoryTimeline';
import { useStoryStore } from '@/lib/store';
import { isSfxSuggestion, sfxCuesFor, soundById } from '@/lib/sfx';
import { formatTime, type Suggestion } from '@/lib/story';
import { palette } from '@/lib/theme';

export default function EditorScreen() {
  const hasAnalysed = useStoryStore((state) => state.hasAnalysed);
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const audioFileName = useStoryStore((state) => state.audioFileName);
  const statuses = useStoryStore((state) => state.statuses);
  const details = useStoryStore((state) => state.details);
  const setNarrationDuration = useStoryStore((state) => state.setNarrationDuration);
  const setSfxOverride = useStoryStore((state) => state.setSfxOverride);
  const setSoundSourceDuration = useStoryStore((state) => state.setSoundSourceDuration);
  const setStatus = useStoryStore((state) => state.setStatus);

  const {
    audioUri,
    narrationSec,
    timelineSec,
    pxPerSec,
    suggestions,
    waveform,
    hasMeasuredWaveform,
    sfxSettings,
    sounds,
  } = useStoryTimeline();

  const player = useNarrationPlayer(audioUri, narrationSec);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seekDebug, setSeekDebug] = useState<{
    actualPosition: number | null;
    confirmed: boolean | null;
  }>({ actualPosition: null, confirmed: null });
  const playFromHereTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (playFromHereTimerRef.current !== null) clearTimeout(playFromHereTimerRef.current);
    },
    [],
  );

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

  const sfxCues = useMemo(
    () => sfxCuesFor(accepted, sfxSettings, sounds),
    [accepted, sfxSettings, sounds],
  );

  const { playbackDebug: sfxPlaybackDebug, resetTriggers } = useSfxScheduler({
    cues: sfxCues,
    enabled: sfxCues.length > 0,
    position: player.position,
    isPlaying: player.isPlaying,
  });

  const acceptedSfxWithoutSound = accepted.filter(
    (item) => isSfxSuggestion(item) && sfxSettings[item.id]?.soundId == null,
  ).length;

  const selectedSfx = useMemo(
    () =>
      suggestions.find(
        (item) =>
          item.id === selectedId &&
          statuses[item.id] === 'accepted' &&
          isSfxSuggestion(item) &&
          sfxSettings[item.id] !== undefined,
      ) ?? null,
    [selectedId, sfxSettings, statuses, suggestions],
  );

  const { pause, play, seek, seekAndConfirm } = player;
  const openSuggestion = useCallback(
    (suggestion: Suggestion) => {
      pause();
      seek(suggestion.timeSec);
      setSelectedId(suggestion.id);
      router.push({ pathname: '/suggestion/[id]', params: { id: suggestion.id } });
    },
    [pause, seek],
  );

  const selectSfx = useCallback(
    (suggestion: Suggestion) => {
      pause();
      setSelectedId(suggestion.id);
      seek(Math.max(0, suggestion.timeSec - 2));
    },
    [pause, seek],
  );

  const selectTimelineItem = useCallback(
    (suggestion: Suggestion) => {
      if (statuses[suggestion.id] === 'accepted' && isSfxSuggestion(suggestion)) {
        selectSfx(suggestion);
      } else {
        openSuggestion(suggestion);
      }
    },
    [openSuggestion, selectSfx, statuses],
  );

  const moveSfx = useCallback(
    (suggestion: Suggestion, startSec: number) => {
      setSelectedId(suggestion.id);
      setSfxOverride(suggestion.id, { startSec });
    },
    [setSfxOverride],
  );

  const resizeSfx = useCallback(
    (suggestion: Suggestion, startSec: number, durationSec: number) => {
      setSelectedId(suggestion.id);
      setSfxOverride(suggestion.id, { startSec, durationSec });
    },
    [setSfxOverride],
  );

  const sourceDurationForSfx = useCallback(
    (suggestion: Suggestion) =>
      soundById(sounds, sfxSettings[suggestion.id]?.soundId)?.sourceDurationSec ?? undefined,
    [sfxSettings, sounds],
  );

  const playSelectedFromHere = useCallback(async () => {
    if (selectedSfx === null) return;

    const currentSettings = sfxSettings[selectedSfx.id];
    const liveOverride = useStoryStore.getState().sfxOverrides[selectedSfx.id];
    const liveStartSec = liveOverride?.startSec ?? currentSettings.startSec;
    const liveDurationSec = liveOverride?.durationSec ?? currentSettings.durationSec;
    if (!Number.isFinite(liveStartSec) || !Number.isFinite(liveDurationSec)) return;

    const seekTarget = Math.max(0, liveStartSec - 2);
    const auditionLengthSec = liveStartSec - seekTarget + Math.max(0, liveDurationSec) + 2;

    if (playFromHereTimerRef.current !== null) clearTimeout(playFromHereTimerRef.current);
    pause();
    setSeekDebug({ actualPosition: null, confirmed: null });
    const seekResult = await seekAndConfirm(seekTarget);
    setSeekDebug({
      actualPosition: seekResult.actualPosition,
      confirmed: seekResult.confirmed,
    });
    if (!seekResult.confirmed) return;

    resetTriggers();
    play();
    playFromHereTimerRef.current = setTimeout(() => {
      pause();
      playFromHereTimerRef.current = null;
    }, auditionLengthSec * 1000);
  }, [pause, play, resetTriggers, seekAndConfirm, selectedSfx, sfxSettings]);

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
          onSelectSuggestion={selectTimelineItem}
          onSelectSfx={selectSfx}
          onMoveSfx={moveSfx}
          onResizeSfx={resizeSfx}
          sourceDurationForSfx={sourceDurationForSfx}
        />

        {selectedSfx !== null ? (
          <SfxTimingPanel
            key={`${selectedSfx.id}-${sfxSettings[selectedSfx.id].startSec}`}
            suggestion={selectedSfx}
            settings={sfxSettings[selectedSfx.id]}
            sounds={sounds}
            currentPlayhead={player.position}
            narrationSec={narrationSec}
            onChangeStart={(startSec) => setSfxOverride(selectedSfx.id, { startSec })}
            onChangeDuration={(durationSec) => setSfxOverride(selectedSfx.id, { durationSec })}
            onSourceDuration={setSoundSourceDuration}
            onUsePlayhead={() => setSfxOverride(selectedSfx.id, { startSec: player.position })}
            onPlayFromHere={playSelectedFromHere}
            actualPlayerAfterSeek={seekDebug.actualPosition}
            seekConfirmed={seekDebug.confirmed}
            sfxTriggered={sfxPlaybackDebug[selectedSfx.id]?.triggered ?? false}
            onBeforePreview={player.pause}
            onEdit={() => openSuggestion(selectedSfx)}
            onReject={() => {
              player.pause();
              setStatus(selectedSfx.id, 'rejected');
              setSelectedId(null);
            }}
          />
        ) : null}

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
                sfxCount: sfxCues.length,
              })}
            </Typography>
          </View>

          {acceptedSfxWithoutSound > 0 ? (
            <View className="flex-row items-center gap-2">
              <Waves size={14} color={palette.marker} />
              <Typography type="body-xs" className="text-marker flex-1">
                {acceptedSfxWithoutSound} accepted sound effect
                {acceptedSfxWithoutSound === 1 ? '' : 's'} still need a sound. Open the suggestion
                to generate or choose one.
              </Typography>
            </View>
          ) : null}
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

        <Button variant="secondary" size="lg" onPress={() => router.push('/sounds')}>
          <Waves size={18} color={palette.ink} />
          <Button.Label>
            {sounds.length === 0 ? 'Add sound effects' : `Sound library · ${sounds.length}`}
          </Button.Label>
        </Button>

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
  /** Accepted sound effects that have a file and will be heard. */
  sfxCount: number;
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
  sfxCount,
}: PlaybackNoteOptions): string {
  if (hasError) {
    return 'This audio file could not be played. Pick another recording on the Project tab (m4a, mp3 or wav).';
  }
  if (isLoading) return 'Loading your narration…';

  const sfx =
    sfxCount === 0
      ? ''
      : ` · ${sfxCount} sound effect${sfxCount === 1 ? '' : 's'} play over the narration`;

  if (isSimulated) {
    return `Sample project · timeline preview at ${formatTime(narrationSec)}, no narration file on this device${sfx}.`;
  }

  const source = hasMeasuredWaveform
    ? 'waveform read from your file'
    : 'waveform matched to your file length';
  const mix = hasAccepted ? ' · accepted suggestions are applied while playing' : '';
  return `Playing ${fileName ?? 'your narration'} · ${formatTime(narrationSec)} · ${source}${mix}${sfx}`;
}
