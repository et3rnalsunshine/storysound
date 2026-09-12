import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Pause, Play, Plus, Trash2, Waves } from 'lucide-react-native';
import { Button, CloseButton, Input, Label, Surface, TextField, Typography } from 'heroui-native';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { useSfxPreview } from '@/hooks/useSfxPreview';
import { goBackOrReplace } from '@/lib/navigation';
import { SFX_NAME_PRESETS, type SoundAsset } from '@/lib/sfx';
import { formatFileSize, titleFromFileName } from '@/lib/story';
import { palette } from '@/lib/theme';
import { useStoryStore } from '@/lib/store';

/** How much of a sound is played when previewing it in the library. */
const LIBRARY_PREVIEW_SEC = 6;

function close() {
  goBackOrReplace('/(tabs)');
}

export default function SoundLibraryScreen() {
  const sounds = useStoryStore((state) => state.sounds);
  const addSound = useStoryStore((state) => state.addSound);
  const renameSound = useStoryStore((state) => state.renameSound);
  const removeSound = useStoryStore((state) => state.removeSound);
  const preview = useSfxPreview();

  const pickSound = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled) return;

    for (const asset of result.assets) {
      addSound({
        name: titleFromFileName(asset.name),
        fileName: asset.name,
        uri: asset.uri,
        sizeLabel: formatFileSize(asset.size),
        source: 'upload',
        prompt: null,
      });
    }
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
        <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
          Sound library
        </Typography>
        <CloseButton onPress={close} accessibilityLabel="Close sound library" />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Typography type="h3" className="text-ink">
            Your sound effects
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            Upload short audio files (mp3, wav or m4a) and name them. Sounds you generate from a
            suggestion land here too. A sound-effect suggestion can use any of them — you choose
            which.
          </Typography>
        </View>

        <Button size="lg" onPress={() => void pickSound()}>
          <Plus size={18} color={palette.paper} />
          <Button.Label>Upload sound file</Button.Label>
        </Button>

        {sounds.length === 0 ? (
          <Surface variant="secondary" className="border-border gap-3 rounded-2xl border p-4">
            <View className="flex-row items-center gap-2">
              <Waves size={16} color={palette.sfx} />
              <Typography type="body-sm" weight="semibold" className="text-ink">
                Nothing uploaded yet
              </Typography>
            </View>
            <Typography type="body-sm" className="text-ink-soft">
              For this story you might want sounds such as:
            </Typography>
            <View className="gap-1">
              {SFX_NAME_PRESETS.map((name) => (
                <Typography key={name} type="body-sm" className="text-ink">
                  · {name}
                </Typography>
              ))}
            </View>
          </Surface>
        ) : (
          <View className="gap-4">
            {sounds.map((sound) => (
              <SoundRow
                key={sound.id}
                sound={sound}
                isPreviewing={preview.playingId === sound.id}
                onRename={(name) => renameSound(sound.id, name)}
                onPreview={() => {
                  if (preview.playingId === sound.id) {
                    preview.stop();
                    return;
                  }
                  preview.play({
                    id: sound.id,
                    uri: sound.uri,
                    volume: 1,
                    durationSec: LIBRARY_PREVIEW_SEC,
                  });
                }}
                onRemove={() => {
                  if (preview.playingId === sound.id) preview.stop();
                  removeSound(sound.id);
                }}
              />
            ))}
          </View>
        )}

        <Typography type="body-xs" className="text-ink-soft">
          Sounds stay on this device for this session and are only heard where you accept a
          sound-effect suggestion.
        </Typography>

        <Button variant="secondary" size="lg" onPress={close}>
          <Button.Label>Done</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type SoundRowProps = {
  sound: SoundAsset;
  isPreviewing: boolean;
  onRename: (name: string) => void;
  onPreview: () => void;
  onRemove: () => void;
};

function SoundRow({ sound, isPreviewing, onRename, onPreview, onRemove }: SoundRowProps) {
  const [name, setName] = useState(sound.name);

  return (
    <Surface className="border-border gap-4 rounded-2xl border p-4">
      <TextField>
        <Label>Sound name</Label>
        <Input
          value={name}
          onChangeText={(next) => {
            setName(next);
            onRename(next);
          }}
          placeholder="Wind forming"
        />
      </TextField>

      <Typography type="body-xs" className="text-ink-soft" numberOfLines={1}>
        {[
          sound.source === 'generated' ? 'Generated with AI' : 'Uploaded',
          sound.fileName,
          sound.sizeLabel,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Typography>

      {sound.prompt === null ? null : (
        <Typography type="body-xs" className="text-ink-soft">
          From your description: “{sound.prompt}”
        </Typography>
      )}

      <View className="flex-row gap-3">
        <Button variant="secondary" size="md" className="flex-1" onPress={onPreview}>
          {isPreviewing ? (
            <Pause size={16} color={palette.ink} />
          ) : (
            <Play size={16} color={palette.ink} />
          )}
          <Button.Label>{isPreviewing ? 'Stop' : 'Preview'}</Button.Label>
        </Button>
        <Button variant="tertiary" size="md" onPress={onRemove} accessibilityLabel="Remove sound">
          <Trash2 size={16} color={palette.inkSoft} />
          <Button.Label>Remove</Button.Label>
        </Button>
      </View>
    </Surface>
  );
}
