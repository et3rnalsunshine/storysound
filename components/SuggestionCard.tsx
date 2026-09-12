import { useState } from 'react';
import { Check, Clock, Pencil, X } from 'lucide-react-native';
import {
  Button,
  Description,
  Label,
  Surface,
  TextArea,
  TextField,
  Typography,
} from 'heroui-native';
import { View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { isSuggestionEdited, useStoryStore } from '@/lib/store';
import { formatTime, type Suggestion, TRACK_NAME } from '@/lib/story';
import { palette } from '@/lib/theme';

type SuggestionCardProps = {
  suggestion: Suggestion;
  /** Called after the user accepts, rejects or dismisses the suggestion. */
  onDone: () => void;
};

/** The AI suggestion card. Every outcome here is chosen by the user. */
export function SuggestionCard({ suggestion, onDone }: SuggestionCardProps) {
  const status = useStoryStore((state) => state.statuses[suggestion.id]) ?? 'pending';
  const detail = useStoryStore((state) => state.details[suggestion.id]) ?? suggestion.detail;
  const setStatus = useStoryStore((state) => state.setStatus);
  const saveDetail = useStoryStore((state) => state.saveDetail);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(detail);

  const edited = isSuggestionEdited(suggestion, detail);

  const handleSave = () => {
    const next = draft.trim();
    if (next.length > 0) saveDetail(suggestion.id, next);
    setIsEditing(false);
  };

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
              autoFocus
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
            <Button.Label>Save your wording</Button.Label>
          </Button>
          <Button
            size="lg"
            variant="tertiary"
            onPress={() => {
              setDraft(detail);
              setIsEditing(false);
            }}
          >
            <Button.Label>Cancel</Button.Label>
          </Button>
        </View>
      ) : (
        <View className="gap-3">
          <Button
            size="lg"
            onPress={() => {
              setStatus(suggestion.id, 'accepted');
              onDone();
            }}
          >
            <Check size={18} color={palette.paper} />
            <Button.Label>Accept</Button.Label>
          </Button>

          <View className="flex-row gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onPress={() => {
                setDraft(detail);
                setIsEditing(true);
              }}
            >
              <Pencil size={16} color={palette.ink} />
              <Button.Label>Modify</Button.Label>
            </Button>

            <Button
              size="lg"
              variant="tertiary"
              className="flex-1"
              onPress={() => {
                setStatus(suggestion.id, 'rejected');
                onDone();
              }}
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
