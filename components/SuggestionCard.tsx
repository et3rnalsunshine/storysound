import { useState } from 'react';
import { Check, Clock, Pause, Pencil, Play, Waves, X } from 'lucide-react-native';
import {
  Button,
  Description,
  Label,
  LinkButton,
  Radio,
  RadioGroup,
  Slider,
  Surface,
  TextArea,
  TextField,
  Typography,
} from 'heroui-native';
import { View } from 'react-native';
import { router } from 'expo-router';

import { StatusPill } from '@/components/StatusPill';
import { useSfxPreview } from '@/hooks/useSfxPreview';
import { useStoryTimeline } from '@/hooks/useStoryTimeline';
import { isSuggestionEdited, useStoryStore } from '@/lib/store';
import {
  defaultSfxSettings,
  formatCueTime,
  formatSfxDuration,
  formatSfxVolume,
  isSfxSuggestion,
  maxSfxDurationFor,
  MIN_SFX_DURATION_SEC,
  type SfxSettings,
  soundById,
} from '@/lib/sfx';
import { formatTime, type Suggestion, TRACK_NAME } from '@/lib/story';
import { palette } from '@/lib/theme';

type SuggestionCardProps = {
  suggestion: Suggestion;
  /** Called after the user accepts, rejects or dismisses the suggestion. */
  onDone: () => void;
};

/** Reads a HeroUI slider value, which can be a single value or a range. */
function singleValue(value: number | number[]): number {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}

/** The AI suggestion card. Every outcome here is chosen by the user. */
export function SuggestionCard({ suggestion, onDone }: SuggestionCardProps) {
  const status = useStoryStore((state) => state.statuses[suggestion.id]) ?? 'pending';
  const detail = useStoryStore((state) => state.details[suggestion.id]) ?? suggestion.detail;
  const setStatus = useStoryStore((state) => state.setStatus);
  const saveDetail = useStoryStore((state) => state.saveDetail);
  const setSfxOverride = useStoryStore((state) => state.setSfxOverride);

  const { narrationSec, sfxSettings, sounds } = useStoryTimeline();
  const preview = useSfxPreview();

  const isSfx = isSfxSuggestion(suggestion);
  const settings = sfxSettings[suggestion.id] ?? defaultSfxSettings(suggestion);
  const sound = soundById(sounds, settings.soundId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(detail);
  const [sfxDraft, setSfxDraft] = useState<SfxSettings>(settings);

  const edited = isSuggestionEdited(suggestion, detail);
  const isPreviewing = preview.playingId === suggestion.id;
  const active = isEditing ? sfxDraft : settings;
  const activeSound = isEditing ? soundById(sounds, sfxDraft.soundId) : sound;

  const startEditing = () => {
    preview.stop();
    setDraft(detail);
    setSfxDraft(settings);
    setIsEditing(true);
  };

  const handleSave = () => {
    preview.stop();
    const next = draft.trim();
    if (next.length > 0) saveDetail(suggestion.id, next);
    if (isSfx) setSfxOverride(suggestion.id, sfxDraft);
    setIsEditing(false);
  };

  const decide = (next: 'accepted' | 'rejected') => {
    preview.stop();
    setStatus(suggestion.id, next);
    onDone();
  };

  const togglePreview = () => {
    if (isPreviewing) {
      preview.stop();
      return;
    }
    if (activeSound === null) return;
    preview.play({
      id: suggestion.id,
      uri: activeSound.uri,
      volume: active.volume,
      durationSec: active.durationSec,
    });
  };

  const openLibrary = () => {
    preview.stop();
    router.push('/sounds');
  };

  const maxStart = Math.max(0, narrationSec - MIN_SFX_DURATION_SEC);
  const maxDuration = maxSfxDurationFor(sfxDraft.startSec, narrationSec);

  return (
    <View className="gap-5">
      <View className="flex-row items-center justify-between">
        <View className="bg-canvas flex-row items-center gap-2 rounded-full px-3 py-1.5">
          <Clock size={14} color={palette.inkSoft} />
          <Typography type="body-sm" weight="semibold" className="text-ink">
            {formatTime(suggestion.timeSec)}
          </Typography>
        </View>
        <StatusPill status={status} size="md" />
      </View>

      <View className="gap-2">
        <Typography type="h4" className="text-ink">
          {suggestion.title}
        </Typography>

        {isEditing ? (
          <TextField>
            <Label>Edit suggestion</Label>
            <TextArea
              value={draft}
              onChangeText={setDraft}
              numberOfLines={4}
              className="min-h-24"
              placeholder="Describe the change you want"
            />
            <Description>Your wording replaces the AI text in this project.</Description>
          </TextField>
        ) : (
          <Typography type="body" className="text-ink">
            {detail}
          </Typography>
        )}

        {edited && !isEditing ? (
          <Typography type="body-xs" className="text-ink-soft">
            Original AI suggestion: {suggestion.detail}
          </Typography>
        ) : null}
      </View>

      {isSfx ? (
        <Surface variant="secondary" className="gap-4 rounded-xl p-4">
          <View className="flex-row items-center gap-2">
            <Waves size={16} color={palette.sfx} />
            <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
              Sound effect
            </Typography>
          </View>

          <View className="gap-1">
            <Typography
              type="body"
              weight={activeSound === null ? 'normal' : 'semibold'}
              className={activeSound === null ? 'text-ink-soft' : 'text-ink'}
            >
              {activeSound?.name ?? 'No sound chosen yet'}
            </Typography>
            <Typography type="body-sm" className="text-ink-soft">
              Starts {formatCueTime(active.startSec)} · plays for{' '}
              {formatSfxDuration(active.durationSec)} · volume {formatSfxVolume(active.volume)}
            </Typography>
          </View>

          {isEditing ? (
            <View className="gap-5">
              {sounds.length === 0 ? (
                <View className="gap-2">
                  <Typography type="body-sm" className="text-ink-soft">
                    Your sound library is empty. Upload an audio file to use it here.
                  </Typography>
                  <Button variant="secondary" size="md" onPress={openLibrary}>
                    <Button.Label>Open sound library</Button.Label>
                  </Button>
                </View>
              ) : (
                <View className="gap-2">
                  <Label>Sound</Label>
                  <RadioGroup
                    value={sfxDraft.soundId ?? ''}
                    onValueChange={(value) => {
                      preview.stop();
                      setSfxDraft((current) => ({ ...current, soundId: value }));
                    }}
                  >
                    {sounds.map((item) => (
                      <RadioGroup.Item key={item.id} value={item.id}>
                        <View className="flex-1 pr-3">
                          <Label>{item.name}</Label>
                          <Description numberOfLines={1}>{item.fileName}</Description>
                        </View>
                        <Radio />
                      </RadioGroup.Item>
                    ))}
                  </RadioGroup>
                  <LinkButton size="sm" className="self-start" onPress={openLibrary}>
                    Upload another sound
                  </LinkButton>
                </View>
              )}

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Label>Start time</Label>
                  <Typography type="body-sm" weight="semibold" className="text-ink">
                    {formatCueTime(sfxDraft.startSec)}
                  </Typography>
                </View>
                <Slider
                  value={sfxDraft.startSec}
                  minValue={0}
                  maxValue={maxStart}
                  step={0.1}
                  onChange={(value) => {
                    const startSec = singleValue(value);
                    setSfxDraft((current) => ({
                      ...current,
                      startSec,
                      durationSec: Math.min(
                        current.durationSec,
                        maxSfxDurationFor(startSec, narrationSec),
                      ),
                    }));
                  }}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Label>Duration</Label>
                  <Typography type="body-sm" weight="semibold" className="text-ink">
                    {formatSfxDuration(sfxDraft.durationSec)}
                  </Typography>
                </View>
                <Slider
                  value={sfxDraft.durationSec}
                  minValue={MIN_SFX_DURATION_SEC}
                  maxValue={maxDuration}
                  step={0.1}
                  onChange={(value) =>
                    setSfxDraft((current) => ({ ...current, durationSec: singleValue(value) }))
                  }
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Label>Volume</Label>
                  <Typography type="body-sm" weight="semibold" className="text-ink">
                    {formatSfxVolume(sfxDraft.volume)}
                  </Typography>
                </View>
                <Slider
                  value={sfxDraft.volume}
                  minValue={0}
                  maxValue={1}
                  step={0.05}
                  onChange={(value) =>
                    setSfxDraft((current) => ({ ...current, volume: singleValue(value) }))
                  }
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </View>
            </View>
          ) : null}

          {activeSound === null ? (
            <Button
              variant="secondary"
              size="md"
              onPress={sounds.length === 0 ? openLibrary : startEditing}
            >
              <Button.Label>
                {sounds.length === 0 ? 'Upload a sound effect' : 'Choose a sound'}
              </Button.Label>
            </Button>
          ) : (
            <Button variant="secondary" size="md" onPress={togglePreview}>
              {isPreviewing ? (
                <Pause size={16} color={palette.ink} />
              ) : (
                <Play size={16} color={palette.ink} />
              )}
              <Button.Label>{isPreviewing ? 'Stop preview' : 'Preview sound'}</Button.Label>
            </Button>
          )}

          <Typography type="body-xs" className="text-ink-soft">
            Preview plays this effect on its own. Accept it to hear it over your narration.
          </Typography>
        </Surface>
      ) : null}

      <Surface variant="secondary" className="gap-3 rounded-xl p-4">
        <View className="gap-1">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            What the analysis noticed
          </Typography>
          <Typography type="body-sm" className="text-ink">
            {suggestion.observation}
          </Typography>
        </View>
        <View className="gap-1">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            Where it would apply
          </Typography>
          <Typography type="body-sm" className="text-ink">
            {TRACK_NAME[suggestion.clip.track]} · {formatTime(suggestion.clip.startSec)}–
            {formatTime(suggestion.clip.endSec)} · {suggestion.clip.label}
          </Typography>
        </View>
      </Surface>

      {isEditing ? (
        <View className="gap-3">
          <Button size="lg" onPress={handleSave}>
            <Button.Label>{isSfx ? 'Save your changes' : 'Save your wording'}</Button.Label>
          </Button>
          <Button
            size="lg"
            variant="tertiary"
            onPress={() => {
              preview.stop();
              setDraft(detail);
              setSfxDraft(settings);
              setIsEditing(false);
            }}
          >
            <Button.Label>Cancel</Button.Label>
          </Button>
        </View>
      ) : (
        <View className="gap-3">
          <Button size="lg" onPress={() => decide('accepted')}>
            <Check size={18} color={palette.paper} />
            <Button.Label>Accept</Button.Label>
          </Button>

          <View className="flex-row gap-3">
            <Button variant="secondary" size="lg" className="flex-1" onPress={startEditing}>
              <Pencil size={16} color={palette.ink} />
              <Button.Label>Modify</Button.Label>
            </Button>

            <Button
              size="lg"
              variant="tertiary"
              className="flex-1"
              onPress={() => decide('rejected')}
            >
              <X size={16} color={palette.inkSoft} />
              <Button.Label>Reject</Button.Label>
            </Button>
          </View>

          <Typography type="body-xs" className="text-ink-soft text-center">
            You decide. Nothing is applied to your audio until you accept.
          </Typography>
        </View>
      )}
    </View>
  );
}
