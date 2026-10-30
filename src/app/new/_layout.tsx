import { Stack } from 'expo-router';

import { useI18n } from '@/i18n/useI18n';
import { fonts, useTheme } from '@/theme';

export default function NewStickerLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        title: t('new.title'),
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
