import * as DocumentPicker from 'expo-document-picker';
import { AudioLines, FileText, Sparkles, Upload, Waves } from 'lucide-react-native';
import { Button, LinkButton, Surface, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { useStoryStore } from '@/lib/store';
import { formatFileSize, SAMPLE_PROJECT, titleFromFileName } from '@/lib/story';
import { palette } from '@/lib/theme';

export default function ProjectScreen() {
  const manuscriptTitle = useStoryStore((state) => state.manuscriptTitle);
  const manuscriptFileName = useStoryStore((state) => state.manuscriptFileName);
  const manuscriptMeta = useStoryStore((state) => state.manuscriptMeta);
  const audioFileName = useStoryStore((state) => state.audioFileName);
  const audioMeta = useStoryStore((state) => state.audioMeta);
  const isSample = useStoryStore((state) => state.isSample);
  const soundCount = useStoryStore((state) => state.sounds.length);
  const setManuscript = useStoryStore((state) => state.setManuscript);
  const setNarration = useStoryStore((state) => state.setNarration);
  const loadSample = useStoryStore((state) => state.loadSample);
  const clearProject = useStoryStore((state) => state.clearProject);

  const isReady = manuscriptTitle !== null && audioFileName !== null;

  const pickManuscript = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/*', 'application/pdf', 'application/msword', 'application/*document*'],
      copyToCacheDirectory: false,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setManuscript(titleFromFileName(asset.name), asset.name, formatFileSize(asset.size));
  };

  const pickNarration = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setNarration(asset.name, formatFileSize(asset.size), asset.uri);
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            StorySound
          </Typography>
          <Typography type="h1" className="text-ink">
            Create an Audio Story
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            Add your manuscript and your own narration. The analysis only suggests enhancements —
            you decide what makes the final version.
          </Typography>
        </View>

        <SourceCard
          icon={<FileText size={20} color={palette.narration} />}
          step="Step 1"
          heading="Manuscript"
          primary={manuscriptTitle ?? 'No manuscript selected'}
          secondary={
            manuscriptFileName === null
              ? 'Text, Word or PDF file'
              : [manuscriptFileName, manuscriptMeta].filter(Boolean).join(' · ')
          }
          isFilled={manuscriptTitle !== null}
          actionLabel={manuscriptTitle === null ? 'Select manuscript' : 'Replace manuscript'}
          onPress={() => void pickManuscript()}
        />

        <SourceCard
          icon={<AudioLines size={20} color={palette.sfx} />}
          step="Step 2"
          heading="Narration audio"
          primary={audioFileName ?? 'No narration selected'}
          secondary={
            audioFileName === null
              ? 'Your recorded reading (m4a, wav, mp3)'
              : (audioMeta ?? 'Audio file ready')
          }
          isFilled={audioFileName !== null}
          actionLabel={audioFileName === null ? 'Select narration audio' : 'Replace narration'}
          onPress={() => void pickNarration()}
        />

        <Surface className="border-border gap-4 rounded-2xl border p-5">
          <View className="flex-row items-center gap-3">
            <View className="bg-canvas h-10 w-10 items-center justify-center rounded-xl">
              <Waves size={20} color={palette.sfx} />
            </View>
            <View className="flex-1">
              <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
                Optional
              </Typography>
              <Typography type="body" weight="semibold" className="text-ink">
                Sound library
              </Typography>
            </View>
          </View>

          <View className="gap-1">
            <Typography
              type="body"
              weight={soundCount > 0 ? 'semibold' : 'normal'}
              className={soundCount > 0 ? 'text-ink' : 'text-ink-soft'}
            >
              {soundCount === 0
                ? 'No sound effects yet'
                : `${soundCount} sound${soundCount === 1 ? '' : 's'} ready`}
            </Typography>
            <Typography type="body-sm" className="text-ink-soft">
              Generate effects from a sound-effect suggestion, or upload your own — water, wind,
              crashing objects. Every effect you keep lands here.
            </Typography>
          </View>

          <Button variant="secondary" size="md" onPress={() => router.push('/sounds')}>
            <Button.Label>{soundCount === 0 ? 'Add sound effects' : 'Manage sounds'}</Button.Label>
          </Button>
        </Surface>

        <Surface variant="secondary" className="border-border gap-3 rounded-2xl border p-5">
          <View className="flex-row items-center justify-between">
            <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
              Sample project
            </Typography>
            {isSample ? (
              <Typography type="body-xs" weight="semibold" className="text-success">
                Loaded
              </Typography>
            ) : null}
          </View>
          <Typography type="h4" className="text-ink">
            {SAMPLE_PROJECT.manuscriptTitle}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft">
            {SAMPLE_PROJECT.blurb} Includes a {SAMPLE_PROJECT.manuscriptWordCount}-word manuscript
            and a {SAMPLE_PROJECT.audioLabel.split(' · ')[0]} narration take.
          </Typography>
          <Button variant="secondary" size="md" onPress={loadSample}>
            <Upload size={16} color={palette.ink} />
            <Button.Label>Load sample project</Button.Label>
          </Button>
          <Typography type="body-xs" className="text-ink-soft">
            The sample runs as a timeline preview. Select your own narration file to hear real
            playback in the editor.
          </Typography>
        </Surface>

        <View className="gap-3">
          <Button size="lg" isDisabled={!isReady} onPress={() => router.push('/analysis')}>
            <Sparkles size={18} color={palette.paper} />
            <Button.Label>Analyse Story</Button.Label>
          </Button>
          <Typography type="body-xs" className="text-ink-soft text-center">
            {isReady
              ? 'The analysis reads your files and returns suggestions you can accept, edit or reject.'
              : 'Add a manuscript and a narration file, or load the sample project.'}
          </Typography>
          {manuscriptTitle !== null || audioFileName !== null ? (
            <LinkButton size="sm" className="self-center" onPress={clearProject}>
              Start over
            </LinkButton>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SourceCardProps = {
  icon: React.ReactNode;
  step: string;
  heading: string;
  primary: string;
  secondary: string;
  isFilled: boolean;
  actionLabel: string;
  onPress: () => void;
};

function SourceCard({
  icon,
  step,
  heading,
  primary,
  secondary,
  isFilled,
  actionLabel,
  onPress,
}: SourceCardProps) {
  return (
    <Surface className="border-border gap-4 rounded-2xl border p-5">
      <View className="flex-row items-center gap-3">
        <View className="bg-canvas h-10 w-10 items-center justify-center rounded-xl">{icon}</View>
        <View className="flex-1">
          <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
            {step}
          </Typography>
          <Typography type="body" weight="semibold" className="text-ink">
            {heading}
          </Typography>
        </View>
      </View>

      <View className="gap-1">
        <Typography
          type="body"
          weight={isFilled ? 'semibold' : 'normal'}
          numberOfLines={2}
          className={isFilled ? 'text-ink' : 'text-ink-soft'}
        >
          {primary}
        </Typography>
        <Typography type="body-sm" className="text-ink-soft" numberOfLines={2}>
          {secondary}
        </Typography>
      </View>

      <Button variant="secondary" size="md" onPress={onPress}>
        <Button.Label>{actionLabel}</Button.Label>
      </Button>
    </Surface>
  );
}
