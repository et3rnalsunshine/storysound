import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Typography } from 'heroui-native';

import { Waveform } from '@/components/Waveform';
import type { SuggestionStatus } from '@/lib/store';
import { palette } from '@/lib/theme';
import {
  BAR_GAP,
  BAR_WIDTH,
  fitWaveform,
  formatTime,
  LANE_HEIGHT,
  MARKER_STRIP_HEIGHT,
  RULER_HEIGHT,
  rulerStepFor,
  type Suggestion,
  TRACK_LABEL_WIDTH,
  TRACKS,
  type TrackId,
} from '@/lib/story';
import { cn } from '@/lib/utils';

const LANES_HEIGHT = LANE_HEIGHT * TRACKS.length;
const MARKER_WIDTH = 58;

const LANE_ACCENT: Record<TrackId, { dot: string; clip: string; ghost: string; text: string }> = {
  narration: {
    dot: 'bg-narration',
    clip: 'bg-narration',
    ghost: 'border-narration',
    text: 'text-narration',
  },
  music: { dot: 'bg-music', clip: 'bg-music', ghost: 'border-music', text: 'text-music' },
  sfx: { dot: 'bg-sfx', clip: 'bg-sfx', ghost: 'border-sfx', text: 'text-sfx' },
};

type Geometry = {
  /** Length of the loaded narration in seconds. */
  narrationSec: number;
  /** Length of the drawn strip, narration plus empty room. */
  timelineSec: number;
  pxPerSec: number;
};

type TimelineProps = Geometry & {
  position: number;
  isPlaying: boolean;
  suggestions: Suggestion[];
  /** Narration peaks, measured from the file when the platform allows it. */
  waveform: number[];
  statuses: Record<string, SuggestionStatus>;
  selectedId: string | null;
  onSeek: (seconds: number) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
};

export function Timeline({
  position,
  isPlaying,
  suggestions,
  waveform,
  narrationSec,
  timelineSec,
  pxPerSec,
  statuses,
  selectedId,
  onSeek,
  onSelectSuggestion,
}: TimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const timelineWidth = timelineSec * pxPerSec;

  useEffect(() => {
    if (!isPlaying || viewportWidth === 0) return;
    const target = Math.max(
      0,
      Math.min(timelineWidth - viewportWidth, position * pxPerSec - viewportWidth * 0.45),
    );
    scrollRef.current?.scrollTo({ x: target, animated: false });
  }, [isPlaying, position, pxPerSec, timelineWidth, viewportWidth]);

  return (
    <View className="border-border bg-panel overflow-hidden rounded-2xl border">
      <View className="flex-row">
        <TrackLabels />

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        >
          <View style={{ width: timelineWidth }}>
            <Ruler timelineSec={timelineSec} pxPerSec={pxPerSec} />
            <MarkerStrip
              suggestions={suggestions}
              statuses={statuses}
              selectedId={selectedId}
              timelineWidth={timelineWidth}
              pxPerSec={pxPerSec}
              onSelectSuggestion={onSelectSuggestion}
            />
            <Lanes
              suggestions={suggestions}
              statuses={statuses}
              waveform={waveform}
              narrationSec={narrationSec}
              timelineSec={timelineSec}
              pxPerSec={pxPerSec}
              onSeek={onSeek}
            />
            <Playhead position={position} pxPerSec={pxPerSec} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function TrackLabels() {
  return (
    <View style={{ width: TRACK_LABEL_WIDTH }} className="border-border bg-panel border-r">
      <View
        style={{ height: RULER_HEIGHT + MARKER_STRIP_HEIGHT }}
        className="border-border justify-end border-b px-3 pb-2"
      >
        <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
          Tracks
        </Typography>
      </View>

      {TRACKS.map((track) => (
        <View
          key={track.id}
          style={{ height: LANE_HEIGHT }}
          className="border-border justify-center gap-1 border-b px-3"
        >
          <View className="flex-row items-center gap-2">
            <View className={cn('h-2 w-2 rounded-full', LANE_ACCENT[track.id].dot)} />
            <Typography type="body-xs" weight="semibold" className="text-ink" numberOfLines={1}>
              {track.name}
            </Typography>
          </View>
          <Typography type="body-xs" className="text-ink-soft" numberOfLines={1}>
            {track.hint}
          </Typography>
        </View>
      ))}
    </View>
  );
}

function Ruler({ timelineSec, pxPerSec }: { timelineSec: number; pxPerSec: number }) {
  const { ticks, step } = useMemo(() => {
    const labelStep = rulerStepFor(pxPerSec);
    const tickStep = labelStep >= 5 ? labelStep / 5 : labelStep;
    const count = Math.floor(timelineSec / tickStep);
    return {
      step: labelStep,
      ticks: Array.from({ length: count + 1 }, (_, index) => index * tickStep),
    };
  }, [pxPerSec, timelineSec]);

  return (
    <View style={{ height: RULER_HEIGHT }} className="border-border bg-canvas border-b">
      {ticks.map((second) => {
        const isLabelled = second % step === 0;
        return (
          <View
            key={second}
            className="absolute bottom-0 items-center"
            style={{ left: second * pxPerSec }}
          >
            {isLabelled ? (
              <Typography type="body-xs" className="text-ink-soft" style={{ fontSize: 10 }}>
                {formatTime(second)}
              </Typography>
            ) : null}
            <View className={cn('bg-lane-line w-px', isLabelled ? 'h-2' : 'h-1')} />
          </View>
        );
      })}
    </View>
  );
}

type MarkerStripProps = {
  suggestions: Suggestion[];
  statuses: Record<string, SuggestionStatus>;
  selectedId: string | null;
  timelineWidth: number;
  pxPerSec: number;
  onSelectSuggestion: (suggestion: Suggestion) => void;
};

function MarkerStrip({
  suggestions,
  statuses,
  selectedId,
  timelineWidth,
  pxPerSec,
  onSelectSuggestion,
}: MarkerStripProps) {
  return (
    <View style={{ height: MARKER_STRIP_HEIGHT }} className="border-border bg-canvas border-b">
      {suggestions.map((suggestion) => {
        const status = statuses[suggestion.id] ?? 'pending';
        const isSelected = selectedId === suggestion.id;
        const left = Math.max(
          0,
          Math.min(timelineWidth - MARKER_WIDTH, suggestion.timeSec * pxPerSec - MARKER_WIDTH / 2),
        );

        return (
          <Pressable
            key={suggestion.id}
            onPress={() => onSelectSuggestion(suggestion)}
            accessibilityRole="button"
            accessibilityLabel={`AI suggestion at ${formatTime(suggestion.timeSec)}`}
            className="absolute top-1.5 items-center justify-center rounded-md px-1.5 py-1"
            style={{ left, width: MARKER_WIDTH }}
          >
            <View
              className={cn(
                'absolute inset-0 rounded-md border',
                status === 'rejected'
                  ? 'border-lane-line bg-canvas'
                  : status === 'accepted'
                    ? 'border-success bg-success/15'
                    : 'border-marker bg-marker/10',
                isSelected && 'border-2',
              )}
            />
            <View className="flex-row items-center gap-1">
              <Sparkles
                size={10}
                color={
                  status === 'rejected'
                    ? palette.inkSoft
                    : status === 'accepted'
                      ? palette.success
                      : palette.marker
                }
              />
              <Typography
                type="body-xs"
                weight="semibold"
                className={cn(
                  status === 'rejected'
                    ? 'text-ink-soft'
                    : status === 'accepted'
                      ? 'text-success'
                      : 'text-marker',
                )}
                style={{ fontSize: 10 }}
              >
                {formatTime(suggestion.timeSec)}
              </Typography>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

type LanesProps = Geometry & {
  suggestions: Suggestion[];
  statuses: Record<string, SuggestionStatus>;
  waveform: number[];
  onSeek: (seconds: number) => void;
};

function Lanes({
  suggestions,
  statuses,
  waveform,
  narrationSec,
  timelineSec,
  pxPerSec,
  onSeek,
}: LanesProps) {
  const timelineWidth = timelineSec * pxPerSec;
  const bars = useMemo(() => {
    const count = Math.max(1, Math.floor(timelineWidth / (BAR_WIDTH + BAR_GAP)));
    return fitWaveform(waveform, count, timelineSec > 0 ? narrationSec / timelineSec : 1);
  }, [narrationSec, timelineSec, timelineWidth, waveform]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Move playhead"
      onPress={(event) => onSeek(event.nativeEvent.locationX / pxPerSec)}
    >
      <View style={{ height: LANES_HEIGHT }}>
        {TRACKS.map((track, index) => (
          <View
            key={track.id}
            style={{ height: LANE_HEIGHT, top: index * LANE_HEIGHT }}
            className="border-border bg-canvas absolute right-0 left-0 justify-center border-b"
          >
            {track.id === 'narration' ? (
              <Waveform
                values={bars}
                height={LANE_HEIGHT - 18}
                barClassName="bg-narration-soft"
                className="px-0"
              />
            ) : null}
          </View>
        ))}

        <View
          pointerEvents="none"
          className="bg-lane-line/60 absolute w-px"
          style={{ left: narrationSec * pxPerSec, top: 0, height: LANES_HEIGHT }}
        />

        {suggestions.map((suggestion) => {
          const status = statuses[suggestion.id] ?? 'pending';
          if (status === 'rejected') return null;

          const laneIndex = TRACKS.findIndex((track) => track.id === suggestion.clip.track);
          const { clip } = suggestion;
          const left = clip.startSec * pxPerSec;
          const width = Math.max(18, (clip.endSec - clip.startSec) * pxPerSec);
          const accent = LANE_ACCENT[clip.track];
          const isApplied = status === 'accepted';

          return (
            <View
              key={suggestion.id}
              className={cn(
                'absolute justify-center overflow-hidden rounded-md px-1.5',
                isApplied ? accent.clip : cn('bg-panel/70 border border-dashed', accent.ghost),
              )}
              style={{
                left,
                width,
                top: laneIndex * LANE_HEIGHT + 10,
                height: LANE_HEIGHT - 22,
                opacity: isApplied ? 1 : 0.85,
              }}
            >
              {width > 62 ? (
                <Typography
                  type="body-xs"
                  weight="medium"
                  numberOfLines={1}
                  className={isApplied ? 'text-panel' : accent.text}
                  style={{ fontSize: 10 }}
                >
                  {isApplied ? clip.label : `${clip.label} · suggested`}
                </Typography>
              ) : null}
            </View>
          );
        })}

        {suggestions.map((suggestion) => (
          <View
            key={`line-${suggestion.id}`}
            className="bg-marker/40 absolute w-px"
            style={{ left: suggestion.timeSec * pxPerSec, top: 0, height: LANES_HEIGHT }}
            pointerEvents="none"
          />
        ))}
      </View>
    </Pressable>
  );
}

function Playhead({ position, pxPerSec }: { position: number; pxPerSec: number }) {
  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={{
        left: position * pxPerSec - 5,
        top: 0,
        height: RULER_HEIGHT + MARKER_STRIP_HEIGHT + LANES_HEIGHT,
        width: 10,
      }}
    >
      <View className="bg-accent h-2 w-2.5 rounded-sm" />
      <View className="bg-accent w-0.5 flex-1" />
    </View>
  );
}
