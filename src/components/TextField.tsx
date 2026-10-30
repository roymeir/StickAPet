import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { useI18n } from '@/i18n/useI18n';
import { fonts, radius, spacing, TOUCH, useTheme } from '@/theme';

import { AppText } from './AppText';

export function TextField({ label, hint, ltr, style, ...rest }: TextInputProps & { label?: string; hint?: string; ltr?: boolean }) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  // API keys and model ids are always left-to-right, even in the Hebrew UI.
  const dirRtl = ltr ? false : rtl;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            textAlign: dirRtl ? 'right' : 'left',
            writingDirection: dirRtl ? 'rtl' : 'ltr',
          },
          style,
        ]}
      />
      {hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    fontFamily: fonts.regular,
  },
});
