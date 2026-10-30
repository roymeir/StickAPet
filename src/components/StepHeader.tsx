import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n/useI18n';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

export const WIZARD_STEPS = 5;

/** "Step 2 of 5" plus a row of dots, at the top of each wizard screen. */
export function StepHeader({ step, title }: { step: number; title: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: WIZARD_STEPS }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < step ? colors.primary : colors.border, flex: i === step - 1 ? 2 : 1 }]} />
        ))}
      </View>
      <AppText variant="caption" color="textMuted">
        {t('new.step', { current: step, total: WIZARD_STEPS })}
      </AppText>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: radius.pill },
});
