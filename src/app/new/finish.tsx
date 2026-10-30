import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CORNER_EMOJIS, EmojiPicker, suggestEmojis, TAG_EMOJIS } from '@/components/EmojiPicker';
import { Banner, Card, Chip, Row, Segmented } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Checker } from '@/components/StickerImage';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/useI18n';
import { type ComposeResult, composeSticker, type StickerFonts } from '@/imaging/compose';
import { encodeStickerWebp } from '@/imaging/exportWebp';
import { loadStickerFonts } from '@/imaging/fonts';
import { describeError } from '@/lib/errors';
import { notify } from '@/lib/dialogs';
import { shareStickerImage } from '@/lib/share';
import { OUTLINE_CHOICES } from '@/state/defaults';
import { useDraft } from '@/state/draftStore';
import { spacing } from '@/theme';

const CAPTION_MAX = 40;

/** Step 5: outline, shadow, caption, corner emoji and WhatsApp tags, with a live preview. */
export default function FinishScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const edited = useDraft((s) => s.edited);
  const finish = useDraft((s) => s.finish);
  const setFinish = useDraft((s) => s.setFinish);
  const { width } = useWindowDimensions();
  const previewSize = Math.min(width - spacing.lg * 2, 340);

  const [fonts, setFonts] = useState<StickerFonts | null | undefined>(undefined);
  const [composed, setComposed] = useState<ComposeResult | null>(null);
  const [sizeKb, setSizeKb] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    void loadStickerFonts().then(setFonts);
  }, []);

  // Re-render the sticker (debounced) whenever an option changes. Same code path as the export,
  // so the preview is exactly what gets saved.
  const opts = useMemo(
    () => ({ outlinePct: finish.outlinePct, shadow: finish.shadow, caption: finish.caption, cornerEmoji: finish.cornerEmoji ?? undefined }),
    [finish.outlinePct, finish.shadow, finish.caption, finish.cornerEmoji],
  );
  useEffect(() => {
    if (!edited || fonts === undefined) return;
    const timer = setTimeout(() => {
      try {
        const result = composeSticker(edited, opts, fonts);
        setComposed(result);
        setSizeKb(Math.ceil(encodeStickerWebp(result.image).bytes.length / 1024));
        setError(null);
      } catch (e) {
        setError(e);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [edited, opts, fonts]);

  // Suggest tags from the caption until the user picks their own.
  useEffect(() => {
    if (!finish.emojisTouched) setFinish({ emojis: suggestEmojis(finish.caption, finish.cornerEmoji ?? undefined) });
  }, [finish.caption, finish.cornerEmoji, finish.emojisTouched, setFinish]);

  const share = async (image: SkImage) => {
    const ok = await shareStickerImage(image, t('new.finish.share'));
    if (!ok) notify(t('common.error'));
  };

  return (
    <Screen
      footer={
        <>
          <Button testID="save-to-pack" label={t('new.finish.save')} icon="albums" disabled={!composed || !!error} onPress={() => router.push('/new/save')} />
          <Button label={t('new.finish.share')} icon="share-outline" variant="secondary" disabled={!composed} onPress={() => composed && share(composed.image)} />
        </>
      }
    >
      <StepHeader step={5} title={t('new.finish.title')} />

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Checker style={{ width: previewSize, height: previewSize }}>
          {composed ? (
            <Canvas style={{ width: previewSize, height: previewSize }} accessibilityLabel={t('new.finish.title')}>
              <SkiaImage image={composed.image} x={0} y={0} width={previewSize} height={previewSize} fit="contain" />
            </Canvas>
          ) : (
            <AppText color="textMuted">{t('new.finish.rendering')}</AppText>
          )}
        </Checker>
        {sizeKb != null ? (
          <AppText variant="caption" color="textMuted" align="center" style={{ writingDirection: 'ltr' }}>
            {t('new.finish.size', { kb: sizeKb })}
          </AppText>
        ) : null}
      </View>

      {error ? <Banner tone="danger">{describeError(error, i18n)}</Banner> : null}

      <Card style={{ gap: spacing.md }}>
        <AppText variant="label">{t('new.finish.outline')}</AppText>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {OUTLINE_CHOICES.map((o) => (
            <Chip key={o} label={o === 0 ? t('common.none') : `${Math.round(o * 100)}%`} selected={finish.outlinePct === o} onPress={() => setFinish({ outlinePct: o })} />
          ))}
        </Row>
        <AppText variant="label">{t('new.finish.shadow')}</AppText>
        <Segmented<'on' | 'off'>
          value={finish.shadow ? 'on' : 'off'}
          onChange={(v) => setFinish({ shadow: v === 'on' })}
          options={[
            { value: 'on', label: t('common.on') },
            { value: 'off', label: t('common.off') },
          ]}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <TextField
          label={t('new.finish.caption')}
          placeholder={t('new.finish.captionPlaceholder')}
          value={finish.caption}
          maxLength={CAPTION_MAX}
          onChangeText={(caption) => setFinish({ caption })}
          returnKeyType="done"
        />
        <AppText variant="label">{t('new.finish.cornerEmoji')}</AppText>
        <EmojiPicker
          options={CORNER_EMOJIS}
          selected={finish.cornerEmoji ? [finish.cornerEmoji] : []}
          onChange={(next) => setFinish({ cornerEmoji: next[0] ?? null })}
          max={1}
          allowNone
          noneLabel={t('common.none')}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="label">{t('new.finish.tags')}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('new.finish.tagsHint')}
        </AppText>
        <EmojiPicker options={TAG_EMOJIS} selected={finish.emojis} onChange={(emojis) => setFinish({ emojis, emojisTouched: true })} max={3} />
      </Card>
    </Screen>
  );
}
