import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Typography } from 'heroui-native';

import { Waveform } from '@/components/Waveform';
import type { SuggestionStatus } from '@/lib/store';
import { palette } from '@/lib/theme';
import {
  formatTime,
  LANE_HEIGHT,
  MARKER_STRIP_HEIGHT,
  NARRATION_WAVEFORM,
  PX_PER_SEC,
  RULER_HEIGHT,
  SUGGESTIONS,
  type Suggestion,
  TIMELINE_SEC,
  TIMELINE_WIDTH,
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

type TimelineProps = {
  position: number;
  isPlaying: boolean;
  statuses: Record<string, SuggestionStatus>;
  selectedId: string | null;
  onSeek: (seconds: number) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
};

export function Timeline({
  position,
  isPlaying,
  statuses,
  selectedId,
  onSeek,
  onSelectSuggestion,
}: TimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (!isPlaying || viewportWidth === 0) return;
    const target = Math.max(
      0,
      Math.min(TIMELINE_WIDTH - viewportWidth, position * PX_PER_SEC - viewportWidth * 0.45),
    );
    scrollRef.current?.scrollTo({ x: target, animated: false });
  }, [isPlaying, position, viewportWidth]);

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
          <View style={{ width: TIMELINE_WIDTH }}>
            <Ruler />
            <MarkerStrip
              statuses={statuses}
              selectedId={selectedId}
              onSelectSuggestion={onSelectSuggestion}
            />
            <Lanes statuses={statuses} onSeek={onSeek} />
            <Playhead position={position} />
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

function Ruler() {
  const seconds = Array.from({ length: TIMELINE_SEC + 1 }, (_, index) => index);

  return (
    <View style={{ height: RULER_HEIGHT }} className="border-border bg-canvas border-b">
      {seconds.map((second) => {
        const isLabelled = second % 5 === 0;
        return (
          <View
            key={second}
            className="absolute bottom-0 items-center"
            style={{ left: second * PX_PER_SEC }}
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
  statuses: Record<string, SuggestionStatus>;
  selectedId: string | null;
  onSelectSuggestion: (suggestion: Suggestion) => void;
};

function MarkerStrip({ statuses, selectedId, onSelectSuggestion }: MarkerStripProps) {
  return (
    <View style={{ height: MARKER_STRIP_HEIGHT }} className="border-border bg-canvas border-b">
      {SUGGESTIONS.map((suggestion) => {
        const status = statuses[suggestion.id] ?? 'pending';
        const isSelected = selectedId === suggestion.id;
        const left = Math.max(
          0,
          Math.min(
            TIMELINE_WIDTH - MARKER_WIDTH,
            suggestion.timeSec * PX_PER_SEC - MARKER_WIDTH / 2,
          ),
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

type LanesProps = {
  statuses: Record<string, SuggestionStatus>;
  onSeek: (seconds: number) => void;
};

function Lanes({ statuses, onSeek }: LanesProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Move playhead"
      onPress={(event) => onSeek(event.nativeEvent.locationX / PX_PER_SEC)}
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
                values={NARRATION_WAVEFORM}
                height={LANE_HEIGHT - 18}
                barClassName="bg-narration-soft"
                className="px-0"
              />
            ) : null}
          </View>
        ))}

        {SUGGESTIONS.map((suggestion) => {
          const status = statuses[suggestion.id] ?? 'pending';
          if (status === 'rejected') return null;

          const laneIndex = TRACKS.findIndex((track) => track.id === suggestion.clip.track);
          const { clip } = suggestion;
          const left = clip.startSec * PX_PER_SEC;
          const width = Math.max(18, (clip.endSec - clip.startSec) * PX_PER_SEC);
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

        {SUGGESTIONS.map((suggestion) => (
          <View
            key={`line-${suggestion.id}`}
            className="bg-marker/40 absolute w-px"
            style={{ left: suggestion.timeSec * PX_PER_SEC, top: 0, height: LANES_HEIGHT }}
            pointerEvents="none"
          />
        ))}
      </View>
    </Pressable>
  );
}

function Playhead({ position }: { position: number }) {
  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={{
        left: position * PX_PER_SEC - 5,
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
