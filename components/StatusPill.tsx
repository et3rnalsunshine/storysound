import { Check, Pencil, Sparkles, X } from 'lucide-react-native';
import { Chip } from 'heroui-native';

import type { SuggestionStatus } from '@/lib/store';
import { palette } from '@/lib/theme';

type StatusPillProps = {
  status: SuggestionStatus;
  size?: 'sm' | 'md';
};

const CONFIG = {
  pending: { label: 'Suggested by AI', color: 'accent', tint: palette.marker, Icon: Sparkles },
  edited: { label: 'Edited by you', color: 'warning', tint: palette.sfx, Icon: Pencil },
  accepted: { label: 'Accepted', color: 'success', tint: palette.success, Icon: Check },
  rejected: { label: 'Not used', color: 'default', tint: palette.inkSoft, Icon: X },
} as const;

/** Shows where a single AI suggestion stands. The user always sets this. */
export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const { label, color, tint, Icon } = CONFIG[status];

  return (
    <Chip size={size} variant="soft" color={color} className="gap-1">
      <Icon color={tint} size={size === 'sm' ? 12 : 14} />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
