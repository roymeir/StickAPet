import { Pressable, StyleSheet, View } from 'react-native';

import type { Pack } from '@/domain/types';
import { useI18n } from '@/i18n/useI18n';
import { stickerUri } from '@/state/appStore';
import { radius, spacing, useTheme } from '@/theme';
import { WA } from '@/whatsapp/limits';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { StickerImage } from './StickerImage';

export function PackTile({ pack, onPress, width }: { pack: Pack; onPress: () => void; width: number }) {
  const { colors } = useTheme();
  const { tp, t } = useI18n();
  const count = pack.stickers.length;
  const missing = Math.max(0, WA.MIN_STICKERS - count);
  const cover = pack.trayFile ?? pack.stickers[0]?.file;
  const imgSize = width - spacing.lg * 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pack.name}, ${tp('home.stickers', count)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border },
      ]}
    >
      {cover ? (
        <StickerImage
          uri={stickerUri(pack.id, cover)}
          cacheKey={`${pack.id}-${cover}-${pack.imageDataVersion}`}
          size={imgSize}
          accessibilityLabel={pack.name}
        />
      ) : (
        <View style={[styles.placeholder, { width: imgSize, height: imgSize, backgroundColor: colors.surfaceAlt }]}>
          <Icon name="paw" size={40} color="textMuted" />
        </View>
      )}
      <AppText variant="label" numberOfLines={1}>
        {pack.name}
      </AppText>
      <View style={styles.meta}>
        <AppText variant="caption" color="textMuted">
          {tp('home.stickers', count)}
        </AppText>
        <View style={[styles.badge, { backgroundColor: missing ? colors.warningSoft : colors.successSoft }]}>
          <AppText variant="caption" color={missing ? 'warning' : 'success'} numberOfLines={1}>
            {missing ? tp('home.needsMore', missing) : t('home.ready')}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  placeholder: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, flexWrap: 'wrap' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
