import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Check, Mic, Sparkles, Waves } from 'lucide-react-native';
import { Button, Surface, Typography } from 'heroui-native';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { DraggableSfxClip } from '@/components/DraggableSfxClip';
import { SfxTimingPanel } from '@/components/SfxTimingPanel';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { TransportControls } from '@/components/TransportControls';
import { Waveform } from '@/components/Waveform';
import { useAssistedMix } from '@/hooks/useAssistedMix';
import { useNarrationPlayer } from '@/hooks/useNarrationPlayer';
import { useSfxScheduler } from '@/hooks/useSfxScheduler';
import { useStoryTimeline } from '@/hooks/useStoryTimeline';
import { useStoryStore } from '@/lib/store';
import {
  formatCueTime,
  formatSfxDuration,
  formatSfxVolume,
  isSfxSuggestion,
  sfxCuesFor,
} from '@/lib/sfx';
import {
  BAR_GAP,
  BAR_WIDTH,
  formatTime,
  resampleWaveform,
  type Suggestion,
  TRACK_NAME,
} from '@/lib/story';
import { palette } from '@/lib/theme';

export default function CompareScreen() {
  const hasAnalysed = useStoryStore((state) => state.hasAnalysed);
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const statuses = useStoryStore((state) => state.statuses);
  const details = useStoryStore((state) => state.details);
  const setSfxOverride = useStoryStore((state) => state.setSfxOverride);

  const { audioUri, narrationSec, suggestions, waveform, sfxSettings, sounds } = useStoryTimeline();

  const original = useNarrationPlayer(audioUri, narrationSec);
  const assisted = useNarrationPlayer(audioUri, narrationSec);
  const [waveWidth, setWaveWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const barCount = Math.max(24, Math.floor(waveWidth / (BAR_WIDTH + BAR_GAP)) || 60);

  const accepted = useMemo(
    () => suggestions.filter((item) => statuses[item.id] === 'accepted'),
    [statuses, suggestions],
  );

  const originalBars = useMemo(() => resampleWaveform(waveform, barCount), [barCount, waveform]);
  const assistedBars = useMemo(
    () => applyAccepted(originalBars, accepted, narrationSec),
    [accepted, narrationSec, originalBars],
  );

  useAssistedMix({
    accepted,
    enabled: false,
    position: original.position,
    isPlaying: original.isPlaying,
    setVolume: original.setVolume,
    pause: original.pause,
    play: original.play,
  });

  useAssistedMix({
    accepted,
    enabled: true,
    position: assisted.position,
    isPlaying: assisted.isPlaying,
    setVolume: assisted.setVolume,
    pause: assisted.pause,
    play: assisted.play,
  });

  const sfxCues = useMemo(
    () => sfxCuesFor(accepted, sfxSettings, sounds),
    [accepted, sfxSettings, sounds],
  );

  const selectedSfx = useMemo(
    () =>
      accepted.find(
        (item) =>
          item.id === selectedId && isSfxSuggestion(item) && sfxSettings[item.id] !== undefined,
      ) ?? null,
    [accepted, selectedId, sfxSettings],
  );

  // Only the assisted player gets the sound effects. The original stays dry.
  useSfxScheduler({
    cues: sfxCues,
    enabled: true,
    position: assisted.position,
    isPlaying: assisted.isPlaying,
  });

  const selectSfx = useCallback(
    (suggestion: Suggestion) => {
      original.pause();
      assisted.pause();
      setSelectedId(suggestion.id);
      assisted.seek(Math.max(0, suggestion.timeSec - 2));
    },
    [assisted, original],
  );

  const moveSfx = useCallback(
    (suggestion: Suggestion, startSec: number) => {
      setSelectedId(suggestion.id);
      setSfxOverride(suggestion.id, { startSec });
    },
    [setSfxOverride],
  );

  const playSelectedFromHere = useCallback(() => {
    if (selectedSfx === null) return;
    original.pause();
    assisted.pause();
    assisted.seek(Math.max(0, selectedSfx.timeSec - 2));
    assisted.play();
  }, [assisted, original, selectedSfx]);

  const seekOriginal = useCallback(
    (seconds: number) => {
      assisted.pause();
      original.seek(seconds);
    },
    [assisted, original],
  );

  const seekAssisted = useCallback(
    (seconds: number) => {
      original.pause();
      assisted.seek(seconds);
    },
    [assisted, original],
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
            duration={original.durationSec}
            onToggle={playOriginal}
            onRestart={original.reset}
            onSeek={seekOriginal}
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
              className="bg-lane relative h-14 overflow-hidden rounded-md"
              style={{ width: Math.max(1, waveWidth) }}
            >
              {accepted
                .filter((item) => item.clip.track !== 'narration' && !isSfxSuggestion(item))
                .map((item) => (
                  <View
                    key={item.id}
                    className="bg-music absolute top-2 h-10 rounded-md"
                    style={{
                      left: (item.clip.startSec / narrationSec) * Math.max(1, waveWidth),
                      width: Math.max(
                        18,
                        ((item.clip.endSec - item.clip.startSec) / narrationSec) *
                          Math.max(1, waveWidth),
                      ),
                    }}
                  />
                ))}
              {accepted.filter(isSfxSuggestion).map((item) => (
                <DraggableSfxClip
                  key={item.id}
                  suggestion={item}
                  narrationSec={narrationSec}
                  pxPerSec={Math.max(1, waveWidth) / narrationSec}
                  selected={selectedId === item.id}
                  style={{ top: 4, height: 48 }}
                  onSelect={selectSfx}
                  onMove={moveSfx}
                />
              ))}
            </View>
          </View>

          <TransportControls
            isPlaying={assisted.isPlaying}
            position={assisted.position}
            duration={assisted.durationSec}
            onToggle={playAssisted}
            onRestart={assisted.reset}
            onSeek={seekAssisted}
          />
        </Surface>

        {selectedSfx !== null ? (
          <SfxTimingPanel
            key={`${selectedSfx.id}:${sfxSettings[selectedSfx.id].startSec}`}
            suggestion={selectedSfx}
            settings={sfxSettings[selectedSfx.id]}
            sounds={sounds}
            currentPlayhead={assisted.position}
            onChangeStart={(startSec) => setSfxOverride(selectedSfx.id, { startSec })}
            onUsePlayhead={() => setSfxOverride(selectedSfx.id, { startSec: assisted.position })}
            onPlayFromHere={playSelectedFromHere}
            onBeforePreview={() => {
              original.pause();
              assisted.pause();
            }}
            onEdit={() => {
              original.pause();
              assisted.pause();
              router.push({ pathname: '/suggestion/[id]', params: { id: selectedSfx.id } });
            }}
          />
        ) : null}

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
              {accepted.map((item) => {
                const cue = sfxCues.find((entry) => entry.id === item.id);
                const needsSound = isSfxSuggestion(item) && cue === undefined;

                return (
                  <Pressable
                    key={item.id}
                    onPress={isSfxSuggestion(item) ? () => selectSfx(item) : undefined}
                    accessibilityRole={isSfxSuggestion(item) ? 'button' : undefined}
                    accessibilityLabel={
                      isSfxSuggestion(item)
                        ? `${cue?.soundName ?? item.clip.label}, ${formatCueTime(item.timeSec)}`
                        : undefined
                    }
                    className="flex-row gap-3 rounded-xl"
                  >
                    {needsSound ? (
                      <Waves size={16} color={palette.marker} />
                    ) : (
                      <Check size={16} color={palette.success} />
                    )}
                    <View className="flex-1 gap-0.5">
                      <Typography type="body-sm" weight="semibold" className="text-ink">
                        {isSfxSuggestion(item)
                          ? `${cue?.soundName ?? item.clip.label} · ${formatCueTime(item.timeSec)}`
                          : `${formatTime(item.timeSec)} · ${TRACK_NAME[item.clip.track]}`}
                      </Typography>
                      <Typography type="body-sm" className="text-ink-soft">
                        {details[item.id] ?? item.detail}
                      </Typography>
                      {cue !== undefined ? (
                        <Typography type="body-xs" className="text-sfx">
                          {cue.soundName} (
                          {cue.source === 'generated' ? 'AI-generated' : 'your file'}) · plays at{' '}
                          {formatCueTime(cue.startSec)} for {formatSfxDuration(cue.durationSec)} at{' '}
                          {formatSfxVolume(cue.volume)}
                        </Typography>
                      ) : null}
                      {needsSound ? (
                        <Typography type="body-xs" className="text-marker">
                          No sound generated or chosen yet, so nothing is heard for this one.
                        </Typography>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              <Typography type="body-xs" className="text-ink-soft">
                {assisted.isSimulated
                  ? `Sound effects play for real${sfxCues.length > 0 ? '' : ' once you generate or choose one'}. Load your own narration file to hear the pauses and level changes too.`
                  : 'While the assisted version plays, accepted pauses stop the narration for their exact length, accepted mix notes change its level, and accepted sound effects play over it on their own layer.'}
              </Typography>
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
function applyAccepted(bars: number[], accepted: Suggestion[], narrationSec: number): number[] {
  if (bars.length === 0) return bars;
  const secPerBar = narrationSec / bars.length;

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
