import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Banner, Card, Row } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useI18n } from '@/i18n/useI18n';
import { preparePhoto } from '@/imaging/prepare';
import { describeError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { warmUpCutout } from '@/native/cutout';
import { useAppStore } from '@/state/appStore';
import { useDraft } from '@/state/draftStore';
import { radius, spacing } from '@/theme';

export default function PickPhotoScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const { packId } = useLocalSearchParams<{ packId?: string }>();
  const source = useDraft((s) => s.source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; settings?: boolean } | null>(null);

  // A fresh wizard every time this screen is opened from Home / a pack.
  useEffect(() => {
    const { outlinePct, shadow } = useAppStore.getState().data.settings;
    useDraft.getState().start({ targetPackId: packId ?? null, outlinePct, shadow });
    warmUpCutout();
  }, [packId]);

  const pick = async (camera: boolean) => {
    setError(null);
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError({ text: t('new.pick.cameraDenied'), settings: true });
          return;
        }
      }
      // The system photo picker needs no library permission on iOS 14+ / Android 13+.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
      const res = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setBusy(true);
      const prepared = await preparePhoto(asset.uri, asset.width, asset.height);
      useDraft.getState().set({ source: { key: newId('ph'), ...prepared }, run: null, base: null, strokes: [], edited: null });
      router.push('/new/style');
    } catch (e) {
      setError({ text: describeError(e, i18n) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button testID="pick-gallery" label={t('new.pick.gallery')} icon="images" onPress={() => pick(false)} loading={busy} />
          {Platform.OS !== 'web' ? <Button label={t('new.pick.camera')} icon="camera" variant="secondary" onPress={() => pick(true)} disabled={busy} /> : null}
          {source ? <Button label={t('common.next')} icon="arrow-forward" variant="ghost" onPress={() => router.push('/new/style')} /> : null}
        </>
      }
    >
      <StepHeader step={1} title={t('new.pick.title')} />
      <AppText color="textMuted">{t('new.pick.body')}</AppText>

      {source ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: source.uri }} style={styles.preview} contentFit="cover" accessibilityLabel={t('new.pick.title')} />
        </View>
      ) : (
        <Card style={{ gap: spacing.md }}>
          {(['new.pick.tip1', 'new.pick.tip2', 'new.pick.tip3'] as const).map((k, i) => (
            <Row key={k}>
              <Icon name={(['paw', 'expand', 'color-palette'] as const)[i]!} color="primary" size={24} />
              <AppText style={{ flex: 1 }}>{t(k)}</AppText>
            </Row>
          ))}
        </Card>
      )}

      {busy ? <Banner tone="info">{t('new.pick.preparing')}</Banner> : null}
      {error ? (
        <Banner
          tone="danger"
          action={error.settings ? <Button size="md" variant="secondary" label={t('new.pick.openSettings')} onPress={() => Linking.openSettings()} /> : undefined}
        >
          {error.text}
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWrap: { alignItems: 'center' },
  preview: { width: '100%', aspectRatio: 1, maxWidth: 420, borderRadius: radius.xl },
});
