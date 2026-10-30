import { I18nManager, Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { useI18n } from '@/i18n/useI18n';
import { fonts, type Palette, useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: keyof Palette;
  align?: 'auto' | 'center' | 'start' | 'end';
  weight?: keyof typeof fonts;
}

const sizes: Record<Variant, { fontSize: number; lineHeight: number; font: keyof typeof fonts }> = {
  display: { fontSize: 30, lineHeight: 38, font: 'heavy' },
  title: { fontSize: 24, lineHeight: 31, font: 'bold' },
  heading: { fontSize: 18, lineHeight: 25, font: 'bold' },
  body: { fontSize: 16, lineHeight: 23, font: 'regular' },
  label: { fontSize: 16, lineHeight: 21, font: 'medium' },
  caption: { fontSize: 13.5, lineHeight: 19, font: 'regular' },
};

/**
 * Text that follows the app language direction. "start"/"end" alignment is resolved from the
 * selected language, so Hebrew screens align right even when a string contains Latin text.
 */
export function AppText({ variant = 'body', color = 'text', align = 'start', weight, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  const s = sizes[variant];
  const textAlign =
    align === 'center' ? 'center' : align === 'auto' ? 'auto' : (align === 'start') !== rtl ? 'left' : 'right';
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors[color],
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          fontFamily: fonts[weight ?? s.font],
          textAlign: physicalAlign(textAlign),
          writingDirection: rtl ? 'rtl' : 'ltr',
        },
        styles.base,
        style,
      ]}
    />
  );
}

/**
 * React Native on iOS swaps left/right text alignment when the native layout is RTL; Android
 * and web treat them as physical sides. We want physical sides, so undo the swap on iOS.
 */
function physicalAlign(align: 'left' | 'right' | 'center' | 'auto') {
  if (Platform.OS !== 'ios' || align === 'center' || align === 'auto' || !I18nManager.isRTL) return align;
  return align === 'left' ? 'right' : 'left';
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
