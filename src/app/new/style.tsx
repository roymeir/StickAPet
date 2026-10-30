import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Banner, Row } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { estimateCostUsd } from '@/config/ai';
import { getStyle, STYLES, type StickerStyle } from '@/config/styles';
import { useI18n } from '@/i18n/useI18n';
import { useAppStore } from '@/state/appStore';
import { useDraft } from '@/state/draftStore';
import { getApiKey } from '@/storage/secrets';
import { radius, spacing, useTheme } from '@/theme';

const CARD = 132;

export default function StyleScreen() {
  const { t, pick, tp } = useI18n();
  const { colors } = useTheme();
  const source = useDraft((s) => s.source);
  const styleId = useDraft((s) => s.styleId);
  const settings = useAppStore((s) => s.data.settings);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getApiKey().then((k) => setHasKey(!!k));
    }, []),
  );

  const style = getStyle(styleId);
  const isAi = !!style.prompt;
  const blocked = isAi && hasKey === false;

  const renderItem = ({ item }: { item: StickerStyle }) => {
    const selected = item.id === styleId;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${pick(item.name)}. ${pick(item.tagline)}`}
        onPress={() => useDraft.getState().set({ styleId: item.id })}
        style={[styles.card, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }]}
      >
        <Image source={item.thumbnail} style={styles.thumb} contentFit="cover" />
        <AppText variant="label" align="center" numberOfLines={1} color={selected ? 'primary' : 'text'}>
          {pick(item.name)}
        </AppText>
        {selected ? (
          <View style={[styles.check, { backgroundColor: colors.primary }]}>
            <Icon name="checkmark" size={16} color="onPrimary" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Screen
      footer={
        <Button
          testID="create-sticker"
          label={t('new.style.create')}
          icon="sparkles"
          disabled={!source || blocked}
          onPress={() => router.push('/new/generate')}
        />
      }
    >
      <StepHeader step={2} title={t('new.style.title')} />
      {source ? (
        <Row>
          <Image source={{ uri: source.uri }} style={styles.source} contentFit="cover" />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{pick(style.name)}</AppText>
            <AppText color="textMuted">{pick(style.tagline)}</AppText>
            <AppText variant="caption" color={isAi ? 'primary' : 'success'}>
              {isAi
                ? `${t('new.style.ai', { cost: estimateCostUsd(settings.quality, settings.variants).toFixed(2) })} · ${tp('new.style.variants', settings.variants)}`
                : t('new.style.free')}
            </AppText>
          </View>
        </Row>
      ) : null}

      <FlatList
        data={STYLES}
        horizontal
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
        style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, flexGrow: 0 }}
        snapToInterval={CARD + spacing.md}
        decelerationRate="fast"
        initialNumToRender={10}
      />

      {blocked ? (
        <Banner tone="warning" action={<Button size="md" variant="secondary" icon="key" label={t('new.style.addKey')} onPress={() => router.push('/settings')} />}>
          {t('new.style.needsKey')}
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD, borderRadius: radius.lg, borderWidth: 2, padding: spacing.sm, gap: spacing.sm },
  thumb: { width: CARD - spacing.sm * 2 - 4, height: CARD - spacing.sm * 2 - 4, borderRadius: radius.md },
  check: { position: 'absolute', top: 8, end: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  source: { width: 96, height: 96, borderRadius: radius.lg },
});
