import { CloseButton, Typography } from 'heroui-native';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { SuggestionCard } from '@/components/SuggestionCard';
import { goBackOrReplace } from '@/lib/navigation';
import { SUGGESTIONS } from '@/lib/story';

function close() {
  goBackOrReplace('/(tabs)/editor');
}

export default function SuggestionModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const suggestion = SUGGESTIONS.find((item) => item.id === id);

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="border-border flex-row items-center justify-between border-b px-5 py-4">
        <Typography type="body-xs" className="text-ink-soft tracking-widest uppercase">
          AI suggestion
        </Typography>
        <CloseButton onPress={close} accessibilityLabel="Close suggestion" />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-5 pb-10 pt-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {suggestion ? (
          <SuggestionCard suggestion={suggestion} onDone={close} />
        ) : (
          <Typography type="body" className="text-ink">
            This suggestion is no longer available.
          </Typography>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
