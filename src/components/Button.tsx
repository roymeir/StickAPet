import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { fonts, type Palette, radius, TOUCH, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md';
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

const WHATSAPP_GREEN = '#25D366';

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, size = 'lg', style, accessibilityHint, testID }: ButtonProps) {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; bgPressed: string; fg: keyof Palette | string; border?: string }> = {
    primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: 'onPrimary' },
    secondary: { bg: colors.surface, bgPressed: colors.surfaceAlt, fg: 'text', border: colors.border },
    ghost: { bg: 'transparent', bgPressed: colors.surfaceAlt, fg: 'primary' },
    danger: { bg: colors.dangerSoft, bgPressed: colors.dangerSoft, fg: 'danger' },
    whatsapp: { bg: WHATSAPP_GREEN, bgPressed: '#1EB257', fg: '#0B3D1E' },
  };
  const p = palette[variant];
  const fgColor = p.fg in colors ? colors[p.fg as keyof Palette] : p.fg;
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: pressed ? p.bgPressed : p.bg, borderColor: p.border ?? 'transparent', opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={fgColor} />
        ) : icon ? (
          <Icon name={icon} color={fgColor} size={size === 'lg' ? 22 : 19} />
        ) : null}
        <AppText
          variant="label"
          numberOfLines={1}
          align="center"
          style={{ color: fgColor, fontFamily: fonts.bold, fontSize: size === 'lg' ? 17 : 15.5 }}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lg: { minHeight: TOUCH + 6 },
  md: { minHeight: TOUCH - 4, borderRadius: radius.md, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
