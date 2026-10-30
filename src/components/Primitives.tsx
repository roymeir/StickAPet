import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { type Palette, radius, spacing, TOUCH, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow, shadowOpacity: dark ? 0 : 0.08 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="heading" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
      {children}
    </AppText>
  );
}

type Tone = 'info' | 'warning' | 'danger' | 'success';
const toneColors: Record<Tone, { bg: keyof Palette; fg: keyof Palette; icon: IconName }> = {
  info: { bg: 'accentSoft', fg: 'text', icon: 'information-circle' },
  warning: { bg: 'warningSoft', fg: 'warning', icon: 'alert-circle' },
  danger: { bg: 'dangerSoft', fg: 'danger', icon: 'close-circle' },
  success: { bg: 'successSoft', fg: 'success', icon: 'checkmark-circle' },
};

export function Banner({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const { colors } = useTheme();
  const t = toneColors[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors[t.bg] }]}>
      <View style={styles.bannerRow}>
        <Icon name={t.icon} color={t.fg} size={22} />
        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            <AppText variant="label" color={t.fg}>
              {title}
            </AppText>
          ) : null}
          {typeof children === 'string' ? <AppText variant="body">{children}</AppText> : children}
        </View>
      </View>
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  big,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  big?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        big && styles.chipBig,
        {
          backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="label" align="center" color={selected ? 'primary' : 'text'} style={big ? { fontSize: 24, lineHeight: 30 } : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface, borderColor: colors.primary }]}
          >
            <AppText variant="label" align="center" color={selected ? 'primary' : 'textMuted'} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ progress, indeterminate }: { progress: number; indeterminate?: boolean }) {
  const { colors } = useTheme();
  const pct = Math.max(0.04, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

export function Row({ children, style, gap = spacing.md }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 0,
  },
  banner: { borderRadius: radius.md, padding: spacing.md },
  bannerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBig: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 8, borderRadius: radius.md },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 6,
  },
  track: { height: 12, borderRadius: 6, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: 6 },
});
