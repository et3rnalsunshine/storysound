import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Waves,
  X,
} from 'lucide-react-native';
import {
  Button,
  Description,
  Label,
  LinkButton,
  Radio,
  RadioGroup,
  Slider,
  Spinner,
  Surface,
  TextArea,
  TextField,
  Typography,
} from 'heroui-native';
import { View } from 'react-native';
import { router } from 'expo-router';

import { StatusPill } from '@/components/StatusPill';
import { useSfxGeneration } from '@/hooks/useSfxGeneration';
import { useSfxPreview } from '@/hooks/useSfxPreview';
import { useStoryTimeline } from '@/hooks/useStoryTimeline';
import { isSuggestionEdited, useStoryStore } from '@/lib/store';
import {
  defaultSfxSettings,
  formatCueTime,
  formatSfxDuration,
  formatSfxVolume,
  isPromptReady,
  isSfxSuggestion,
  MAX_SFX_PROMPT_LENGTH,
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

/** One labelled line of the sound-effect summary. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Typography type="body-sm" className="text-ink-soft">
        {label}
      </Typography>
      <Typography type="body-sm" weight="semibold" className="text-ink flex-1 text-right">
        {value}
      </Typography>
    </View>
  );
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
  const generation = useSfxGeneration(suggestion.id);

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
  const canGenerate = isPromptReady(active.prompt) && !generation.isGenerating;

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

  /** Generates from whatever description is on screen, saving any open edits. */
  const runGeneration = () => {
    preview.stop();
    generation.dismissError();

    if (isEditing) {
      const next = draft.trim();
      if (next.length > 0) saveDetail(suggestion.id, next);
      setSfxOverride(suggestion.id, sfxDraft);
      setIsEditing(false);
      generation.generate({
        prompt: sfxDraft.prompt,
        durationSec: sfxDraft.durationSec,
        patch: sfxDraft,
      });
      return;
    }

    generation.generate({ prompt: settings.prompt, durationSec: settings.durationSec });
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
              Suggested by AI · sound effect
            </Typography>
          </View>

          <View className="gap-2">
            <DetailRow label="Sound" value={active.prompt} />
            <DetailRow
              label="Generated file"
              value={activeSound === null ? 'Not generated yet' : activeSound.name}
            />
            <DetailRow label="Start" value={formatCueTime(active.startSec)} />
            <DetailRow label="Duration" value={formatSfxDuration(active.durationSec)} />
            <DetailRow label="Volume" value={formatSfxVolume(active.volume)} />
          </View>

          {isEditing ? (
            <View className="gap-5">
              <TextField>
                <Label>Sound description</Label>
                <TextArea
                  value={sfxDraft.prompt}
                  onChangeText={(value) =>
                    setSfxDraft((current) => ({
                      ...current,
                      prompt: value.slice(0, MAX_SFX_PROMPT_LENGTH),
                    }))
                  }
                  numberOfLines={3}
                  className="min-h-20"
                  placeholder="Low rising wind with distant rattling"
                />
                <Description>
                  This is the text sent to the sound generator. Change it and generate again.
                </Description>
              </TextField>

              <Button
                variant="secondary"
                size="md"
                isDisabled={!canGenerate}
                onPress={runGeneration}
              >
                <Sparkles size={16} color={palette.ink} />
                <Button.Label>
                  {activeSound === null ? 'Generate sound' : 'Regenerate with this description'}
                </Button.Label>
              </Button>

              {sounds.length > 0 ? (
                <View className="gap-2">
                  <Label>Or use a sound from your library</Label>
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
                          <Description numberOfLines={1}>
                            {item.source === 'generated' ? 'Generated' : 'Uploaded'} ·{' '}
                            {item.fileName}
                          </Description>
                        </View>
                        <Radio />
                      </RadioGroup.Item>
                    ))}
                  </RadioGroup>
                  <LinkButton size="sm" className="self-start" onPress={openLibrary}>
                    Open sound library
                  </LinkButton>
                </View>
              ) : (
                <LinkButton size="sm" className="self-start" onPress={openLibrary}>
                  Upload your own sound instead
                </LinkButton>
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

          {generation.isGenerating ? (
            <View className="flex-row items-center gap-3">
              <Spinner size="sm" />
              <Typography type="body-sm" className="text-ink">
                Generating this sound from your description…
              </Typography>
            </View>
          ) : null}

          {generation.error !== null ? (
            <View className="border-border gap-3 rounded-lg border p-3">
              <View className="flex-row items-start gap-2">
                <AlertTriangle size={16} color={palette.marker} />
                <Typography type="body-sm" className="text-ink flex-1">
                  {generation.error.message}
                </Typography>
              </View>
              {generation.error.retryable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onPress={runGeneration}
                >
                  <Button.Label>Try again</Button.Label>
                </Button>
              ) : null}
              <Typography type="body-xs" className="text-ink-soft">
                Your narration and the rest of the timeline are unaffected.
              </Typography>
            </View>
          ) : null}

          {isEditing ? null : (
            <View className="gap-3">
              {activeSound === null ? (
                <Button size="md" isDisabled={!canGenerate} onPress={runGeneration}>
                  <Sparkles size={16} color={palette.paper} />
                  <Button.Label>Generate Sound</Button.Label>
                </Button>
              ) : (
                <View className="flex-row gap-3">
                  <Button variant="secondary" size="md" className="flex-1" onPress={togglePreview}>
                    {isPreviewing ? (
                      <Pause size={16} color={palette.ink} />
                    ) : (
                      <Play size={16} color={palette.ink} />
                    )}
                    <Button.Label>{isPreviewing ? 'Stop preview' : 'Preview Sound'}</Button.Label>
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    isDisabled={!canGenerate}
                    onPress={runGeneration}
                  >
                    <RefreshCw size={16} color={palette.ink} />
                    <Button.Label>Regenerate</Button.Label>
                  </Button>
                </View>
              )}

              <LinkButton size="sm" className="self-start" onPress={openLibrary}>
                {sounds.length === 0 ? 'Upload your own sound instead' : 'Open sound library'}
              </LinkButton>
            </View>
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
