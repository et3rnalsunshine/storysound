import { useState } from 'react';
import { Edit3, Headphones, LocateFixed, Pause, Play, Waves, X } from 'lucide-react-native';
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Surface,
  TextField,
  Typography,
} from 'heroui-native';
import { View } from 'react-native';

import { useSfxPreview } from '@/hooks/useSfxPreview';
import {
  formatCueTime,
  formatSfxDuration,
  formatSfxVolume,
  parseCueTime,
  soundById,
  soundDisplayName,
  type SfxSettings,
  type SoundAsset,
} from '@/lib/sfx';
import type { Suggestion } from '@/lib/story';
import { palette } from '@/lib/theme';

type SfxTimingPanelProps = {
  suggestion: Suggestion;
  settings: SfxSettings;
  sounds: SoundAsset[];
  currentPlayhead: number;
  onChangeStart: (startSec: number) => void;
  onUsePlayhead: () => void;
  onPlayFromHere: () => void;
  onEdit: () => void;
  onReject: () => void;
  onBeforePreview?: () => void;
};

/** Precision controls for an accepted effect selected on the story timeline. */
export function SfxTimingPanel({
  suggestion,
  settings,
  sounds,
  currentPlayhead,
  onChangeStart,
  onUsePlayhead,
  onPlayFromHere,
  onEdit,
  onReject,
  onBeforePreview,
}: SfxTimingPanelProps) {
  const [startText, setStartText] = useState(formatCueTime(settings.startSec));
  const [startError, setStartError] = useState<string | null>(null);
  const preview = useSfxPreview();
  const sound = soundById(sounds, settings.soundId);
  const displayName = soundDisplayName(sound, suggestion.clip.label);
  const isPreviewing = preview.playingId === suggestion.id;
  const isPreviewLoading = preview.loadingId === suggestion.id;

  const updateStart = (startSec: number) => {
    setStartText(formatCueTime(startSec));
    setStartError(null);
    onChangeStart(startSec);
  };

  const commitStart = () => {
    const parsed = parseCueTime(startText);
    if (parsed === null) {
      setStartError('Enter a time like 00:20.3');
      return;
    }
    setStartError(null);
    updateStart(parsed);
  };

  const togglePreview = () => {
    if (isPreviewing || isPreviewLoading) {
      preview.stop();
      return;
    }
    if (sound === null) return;
    onBeforePreview?.();
    preview.play({
      id: suggestion.id,
      uri: sound.uri,
      volume: settings.volume,
      durationSec: settings.durationSec,
      byteLength: sound.byteLength,
      mimeType: sound.mimeType,
    });
  };

  return (
    <Surface variant="secondary" className="border-border gap-4 rounded-2xl border p-4">
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <Waves size={16} color={palette.sfx} />
          <Typography type="body-xs" className="text-sfx tracking-widest uppercase">
            Selected sound effect
          </Typography>
        </View>
        <View className="gap-2">
          <View>
            <Typography type="body-xs" className="text-ink-soft">
              Sound effect:
            </Typography>
            <Typography type="body" weight="semibold" className="text-ink">
              {displayName}
            </Typography>
          </View>
          <View className="flex-row flex-wrap gap-x-6 gap-y-2">
            <View>
              <Typography type="body-xs" className="text-ink-soft">
                Start:
              </Typography>
              <Typography type="body-sm" weight="semibold" className="text-ink">
                {formatCueTime(settings.startSec)}
              </Typography>
            </View>
            <View>
              <Typography type="body-xs" className="text-ink-soft">
                Duration:
              </Typography>
              <Typography type="body-sm" weight="semibold" className="text-ink">
                {formatSfxDuration(settings.durationSec)}
              </Typography>
            </View>
            <View>
              <Typography type="body-xs" className="text-ink-soft">
                Volume:
              </Typography>
              <Typography type="body-sm" weight="semibold" className="text-ink">
                {formatSfxVolume(settings.volume)}
              </Typography>
            </View>
            <View>
              <Typography type="body-xs" className="text-ink-soft">
                Status:
              </Typography>
              <Typography type="body-sm" weight="semibold" className="text-success">
                Accepted
              </Typography>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          size="sm"
          variant="secondary"
          onPress={() => updateStart(settings.startSec - 0.5)}
        >
          <Button.Label>-0.5 sec</Button.Label>
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant="secondary"
          onPress={() => updateStart(settings.startSec + 0.5)}
        >
          <Button.Label>+0.5 sec</Button.Label>
        </Button>
      </View>

      <TextField isInvalid={startError !== null}>
        <Label>Exact Start</Label>
        <Input
          value={startText}
          onChangeText={setStartText}
          onBlur={commitStart}
          onSubmitEditing={commitStart}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          placeholder="00:20.3"
        />
        {startError === null ? (
          <Description>Story position, accurate to 0.1 seconds.</Description>
        ) : (
          <FieldError>{startError}</FieldError>
        )}
      </TextField>

      {sound?.prompt !== null && sound?.prompt !== undefined ? (
        <View className="bg-canvas gap-1 rounded-xl p-3">
          <Typography type="body-xs" className="text-ink-soft">
            Full generation prompt
          </Typography>
          <Typography type="body-sm" className="text-ink">
            {sound.prompt}
          </Typography>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={onUsePlayhead}>
          <LocateFixed size={15} color={palette.ink} />
          <Button.Label>Use current playhead</Button.Label>
        </Button>
        <Button size="sm" onPress={onPlayFromHere}>
          <Play size={15} color={palette.paper} fill={palette.paper} />
          <Button.Label>Play from here</Button.Label>
        </Button>
        <Button size="sm" variant="tertiary" isDisabled={sound === null} onPress={togglePreview}>
          {isPreviewing ? (
            <Pause size={15} color={palette.ink} />
          ) : (
            <Headphones size={15} color={palette.ink} />
          )}
          <Button.Label>
            {isPreviewLoading ? 'Loading…' : isPreviewing ? 'Stop preview' : 'Preview'}
          </Button.Label>
        </Button>
        <Button size="sm" variant="tertiary" onPress={onEdit}>
          <Edit3 size={14} color={palette.ink} />
          <Button.Label>Edit</Button.Label>
        </Button>
        <Button size="sm" variant="tertiary" onPress={onReject}>
          <X size={15} color={palette.inkSoft} />
          <Button.Label>Reject</Button.Label>
        </Button>
      </View>

      <Typography type="body-xs" className="text-ink-soft">
        Current playhead: {formatCueTime(currentPlayhead)}. Moving this clip changes when it starts;
        the sound file itself always plays from its beginning.
      </Typography>
      {sound === null ? (
        <Typography type="body-xs" className="text-marker">
          Open Edit to generate or choose a sound before previewing.
        </Typography>
      ) : null}
      {preview.error !== null ? (
        <Typography type="body-xs" className="text-danger">
          {preview.error}
        </Typography>
      ) : null}
    </Surface>
  );
}
