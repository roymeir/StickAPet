import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Banner, Card, SectionTitle } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StickerImage } from '@/components/StickerImage';
import { TextField } from '@/components/TextField';
import { useI18n } from '@/i18n/useI18n';
import { composeSticker } from '@/imaging/compose';
import { encodeStickerWebp } from '@/imaging/exportWebp';
import { loadStickerFonts } from '@/imaging/fonts';
import { describeError } from '@/lib/errors';
import { stickerUri, useAppStore } from '@/state/appStore';
import { useDraft } from '@/state/draftStore';
import { radius, spacing, useTheme } from '@/theme';
import { WA } from '@/whatsapp/limits';

/** Pick an existing (static, non-full) pack or create a new one, then export and save. */
export default function SaveScreen() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const { colors } = useTheme();
  const packs = useAppStore((s) => s.data.packs);
  const targetPackId = useDraft((s) => s.targetPackId);
  const [choice, setSelected] = useState<string | 'new'>(targetPackId ?? packs.find((p) => p.stickers.length < WA.MAX_STICKERS)?.id ?? 'new');
  const selected = choice === 'new' || packs.some((p) => p.id === choice) ? choice : 'new';
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    const { edited, finish, styleId } = useDraft.getState();
    if (!edited) return;
    setSaving(true);
    setError(null);
    try {
      // Final export: same composition as the preview, then the ≤100 KB quality loop.
      const { image } = composeSticker(
        edited,
        { outlinePct: finish.outlinePct, shadow: finish.shadow, caption: finish.caption, cornerEmoji: finish.cornerEmoji ?? undefined },
        await loadStickerFonts(),
      );
      const webp = encodeStickerWebp(image);
      const store = useAppStore.getState();
      const packId = selected === 'new' ? (await store.createPack(name.trim() || t('new.save.defaultName'))).id : selected;
      await useAppStore.getState().addSticker(packId, {
        webp: webp.bytes,
        emojis: finish.emojis,
        styleId,
        caption: finish.caption,
        cornerEmoji: finish.cornerEmoji ?? undefined,
      });
      router.dismissAll();
      router.push({ pathname: '/pack/[id]', params: { id: packId, saved: '1' } });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button testID="confirm-save" label={selected === 'new' ? t('new.save.create') : t('common.save')} icon="checkmark-circle" onPress={save} loading={saving} />}>
      <AppText variant="title" accessibilityRole="header">
        {t('new.save.title')}
      </AppText>

      {packs.length > 0 ? <SectionTitle>{t('new.save.existing')}</SectionTitle> : null}
      {packs.map((p) => {
        const full = p.stickers.length >= WA.MAX_STICKERS;
        const isSel = selected === p.id;
        const cover = p.trayFile ?? p.stickers[0]?.file;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSel, disabled: full }}
            disabled={full}
            onPress={() => setSelected(p.id)}
            style={[styles.row, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primarySoft : colors.surface, opacity: full ? 0.5 : 1 }]}
          >
            {cover ? <StickerImage uri={stickerUri(p.id, cover)} cacheKey={`${p.id}-${p.imageDataVersion}`} size={56} /> : <View style={[styles.empty, { backgroundColor: colors.surfaceAlt }]} />}
            <View style={{ flex: 1 }}>
              <AppText variant="label" numberOfLines={1}>
                {p.name}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {full ? t('new.save.full') : tp('home.stickers', p.stickers.length)}
              </AppText>
            </View>
            <Icon name={isSel ? 'radio-button-on' : 'radio-button-off'} color={isSel ? 'primary' : 'textMuted'} />
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: selected === 'new' }}
        onPress={() => setSelected('new')}
        style={[styles.row, { borderColor: selected === 'new' ? colors.primary : colors.border, backgroundColor: selected === 'new' ? colors.primarySoft : colors.surface }]}
      >
        <Icon name="add-circle" color="primary" size={32} />
        <AppText variant="label" style={{ flex: 1 }}>
          {t('new.save.newPack')}
        </AppText>
        <Icon name={selected === 'new' ? 'radio-button-on' : 'radio-button-off'} color={selected === 'new' ? 'primary' : 'textMuted'} />
      </Pressable>
      {selected === 'new' ? (
        <Card>
          <TextField label={t('new.save.packName')} placeholder={t('new.save.packNamePlaceholder')} value={name} onChangeText={setName} maxLength={WA.MAX_CHARS} autoFocus />
        </Card>
      ) : null}

      {saving ? <Banner tone="info">{t('new.save.saving')}</Banner> : null}
      {error ? <Banner tone="danger">{t('error.saveFailed', { message: describeError(error, i18n) })}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 2, borderRadius: radius.lg, padding: spacing.md, minHeight: 72 },
  empty: { width: 56, height: 56, borderRadius: radius.md },
});
