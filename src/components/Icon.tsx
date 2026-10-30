import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useI18n } from '@/i18n/useI18n';
import { type Palette, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icons that point "forward/back" and must mirror in right-to-left layouts. */
const DIRECTIONAL = new Set<string>(['chevron-forward', 'chevron-back', 'arrow-forward', 'arrow-back', 'arrow-undo', 'arrow-redo']);

/** `color` is a palette key (themed) or any CSS color. */
export function Icon({ name, size = 24, color = 'text' }: { name: IconName; size?: number; color?: keyof Palette | (string & {}) }) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  const flip = rtl && DIRECTIONAL.has(name);
  const resolved = color in colors ? colors[color as keyof Palette] : color;
  return <Ionicons name={name} size={size} color={resolved} style={flip ? { transform: [{ scaleX: -1 }] } : undefined} />;
}
