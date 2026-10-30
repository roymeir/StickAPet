import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PackTile } from '@/components/PackTile';
import { loadDemoPacks } from '@/dev/demoData';
import { useI18n } from '@/i18n/useI18n';
import { useAppStore } from '@/state/appStore';
import { radius, spacing, TOUCH, useTheme } from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const packs = useAppStore((s) => s.data.packs);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 720) - spacing.lg * 2;
  const columns = contentWidth > 520 ? 3 : 2;
  const tileWidth = (contentWidth - spacing.md * (columns - 1)) / columns;

  useWebDemoData();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="primary" weight="bold">
            {t('app.name')}
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            {t('home.title')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.settings')}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border }]}
        >
          <Icon name="settings-outline" size={26} />
        </Pressable>
      </View>

      {packs.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require('../../assets/illustrations/empty.png')} style={styles.emptyArt} contentFit="contain" accessibilityIgnoresInvertColors />
          <AppText variant="title" align="center">
            {t('home.emptyTitle')}
          </AppText>
          <AppText variant="body" color="textMuted" align="center" style={{ maxWidth: 340 }}>
            {t('home.emptyBody')}
          </AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {packs.map((pack) => (
            <PackTile key={pack.id} pack={pack} width={tileWidth} onPress={() => router.push({ pathname: '/pack/[id]', params: { id: pack.id } })} />
          ))}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          testID="new-sticker"
          label={packs.length === 0 ? t('home.emptyCta') : t('home.newSticker')}
          icon="add-circle"
          onPress={() => router.push('/new')}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

/** Web preview only: `?demo=1` fills Home with mock packs for screenshots. */
function useWebDemoData() {
  const { t } = useI18n();
  const done = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || done.current) return;
    if (typeof window === 'undefined' || !/[?&]demo=1/.test(window.location.search)) return;
    if (useAppStore.getState().data.packs.length > 0) return;
    done.current = true;
    void loadDemoPacks({ full: t('new.save.defaultName'), partial: 'Luna' });
  }, [t]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyArt: { width: 300, height: 210 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { minHeight: 64, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
