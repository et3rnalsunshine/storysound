import { useState } from 'react';
import { Edit3, Headphones, LocateFixed, Pause, Play } from 'lucide-react-native';
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
  onBeforePreview,
}: SfxTimingPanelProps) {
  const [startText, setStartText] = useState(formatCueTime(settings.startSec));
  const [startError, setStartError] = useState<string | null>(null);
  const preview = useSfxPreview();
  const sound = soundById(sounds, settings.soundId);
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
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Typography type="body-xs" className="text-sfx tracking-widest uppercase">
            Selected sound effect
          </Typography>
          <Typography type="body" weight="semibold" className="text-ink">
            {suggestion.clip.label}
          </Typography>
          <Typography type="body-xs" className="text-ink-soft">
            Starts {formatCueTime(settings.startSec)} · {formatSfxDuration(settings.durationSec)} ·{' '}
            {formatSfxVolume(settings.volume)} volume
          </Typography>
        </View>
        <Button size="sm" variant="tertiary" onPress={onEdit}>
          <Edit3 size={14} color={palette.ink} />
          <Button.Label>Edit</Button.Label>
        </Button>
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
