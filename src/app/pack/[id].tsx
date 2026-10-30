import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmojiPicker, TAG_EMOJIS } from '@/components/EmojiPicker';
import { Icon } from '@/components/Icon';
import { Banner, Row } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { StickerImage } from '@/components/StickerImage';
import { TextField } from '@/components/TextField';
import type { Sticker } from '@/domain/types';
import { useI18n } from '@/i18n/useI18n';
import { decodeImage } from '@/imaging/skia';
import { confirm, notify } from '@/lib/dialogs';
import { shareStickerImage } from '@/lib/share';
import { stickerUri, useAppStore, usePack } from '@/state/appStore';
import { docStore } from '@/storage/stores';
import { radius, spacing, TOUCH, useTheme } from '@/theme';
import { addPackToWhatsApp, checkPack, getPackStatus, type PackStatus } from '@/whatsapp';
import { packFilePath } from '@/whatsapp/contents';
import { WA } from '@/whatsapp/limits';
import type { ValidationIssue } from '@/whatsapp/validator';

export default function PackScreen() {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const { colors } = useTheme();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const pack = usePack(id);
  const store = useAppStore();
  const { width } = useWindowDimensions();

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(saved ? { tone: 'success', text: '' } : null);
  const [selected, setSelected] = useState<Sticker | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const refresh = useCallback(async () => {
    if (!pack) return;
    setIssues(await checkPack(pack));
    setStatus(await getPackStatus(pack.id));
  }, [pack]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!pack) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Banner tone="warning">{t('pack.notFound')}</Banner>
      </Screen>
    );
  }

  const count = pack.stickers.length;
  const missing = Math.max(0, WA.MIN_STICKERS - count);
  const full = count >= WA.MAX_STICKERS;
  const otherIssues = issues.filter((i) => i.key !== 'wa.tooFew');
  const installed = status && (status.consumerInstalled || status.businessInstalled);
  const addedEverywhere =
    !!installed && (!status!.consumerInstalled || status!.consumerAdded === true) && (!status!.businessInstalled || status!.businessAdded === true);
  const addedSomewhere = !!status && (status.consumerAdded === true || status.businessAdded === true);

  const columns = width > 600 ? 5 : 3;
  const cell = (Math.min(width, 720) - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns;

  const add = async () => {
    setAdding(true);
    setMessage(null);
    try {
      const outcome = await addPackToWhatsApp(pack, t('pack.addToWhatsApp'));
      switch (outcome.kind) {
        case 'added':
          setMessage({ tone: 'success', text: t('pack.added') });
          break;
        case 'opened':
          setMessage(null);
          break;
        case 'cancelled':
          setMessage({ tone: 'info', text: t('pack.cancelled') });
          break;
        case 'not_installed':
          setMessage({ tone: 'danger', text: t('pack.whatsappMissing') });
          break;
        case 'whatsapp_rejected':
          setMessage({ tone: 'danger', text: `${t('pack.notAdded')}\n${outcome.message}` });
          break;
        case 'invalid':
          setIssues(outcome.issues);
          break;
        case 'unsupported':
          setMessage({ tone: 'info', text: t('pack.webUnsupported') });
          break;
      }
    } catch (e) {
      setMessage({ tone: 'danger', text: `${t('pack.notAdded')} ${e instanceof Error ? e.message : ''}` });
    } finally {
      setAdding(false);
      void refresh();
    }
  };

  const deletePack = async () => {
    if (await confirm(t('pack.delete'), t('pack.deleteConfirm', { name: pack.name }), t('common.delete'), t('common.cancel'))) {
      await store.deletePack(pack.id);
      router.back();
    }
  };

  const index = selected ? pack.stickers.findIndex((s) => s.id === selected.id) : -1;
  const current = index >= 0 ? pack.stickers[index]! : null;

  return (
    <Screen
      footer={
        <>
          {addedEverywhere ? (
            <View style={[styles.added, { backgroundColor: colors.successSoft }]} accessibilityRole="text">
              <Icon name="checkmark-circle" color="success" />
              <AppText variant="label" color="success">
                {t('pack.added')}
              </AppText>
            </View>
          ) : null}
          <Button
            testID="add-to-whatsapp"
            variant={addedEverywhere ? 'secondary' : 'whatsapp'}
            icon="logo-whatsapp"
            label={adding ? t('pack.adding') : addedEverywhere ? t('pack.addAgain') : t('pack.addToWhatsApp')}
            loading={adding}
            disabled={issues.length > 0}
            onPress={add}
          />
          <Button
            variant="secondary"
            icon="add"
            label={t('pack.addSticker')}
            disabled={full}
            onPress={() => router.push({ pathname: '/new', params: { packId: pack.id } })}
          />
        </>
      }
    >
      <Stack.Screen
        options={{
          // The pack name is the big page title below; keep the bar clean.
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('pack.renameTitle')}
              hitSlop={10}
              onPress={() => {
                setNameDraft(pack.name);
                setRenaming(true);
              }}
              style={styles.headerBtn}
            >
              <Icon name="create-outline" />
            </Pressable>
          ),
        }}
      />

      <View>
        <AppText variant="title" numberOfLines={2}>
          {pack.name}
        </AppText>
        <AppText color="textMuted">
          {tp('home.stickers', count)} · {t('pack.publisher', { publisher: pack.publisher })}
        </AppText>
      </View>

      {message?.tone === 'success' && !message.text ? <Banner tone="success">{t('new.save.saved', { name: pack.name })}</Banner> : null}
      {message?.text ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {missing > 0 ? <Banner tone="warning">{tp('pack.needMore', missing)}</Banner> : null}
      {full ? <Banner tone="info">{t('pack.full')}</Banner> : null}
      {addedSomewhere && !addedEverywhere ? (
        <Banner tone="info">{status!.consumerAdded ? t('pack.addedConsumer') : t('pack.addedBusiness')}</Banner>
      ) : null}
      {otherIssues.length > 0 ? (
        <Banner tone="danger" title={t('pack.invalidTitle')}>
          <View>
            {otherIssues.map((issue, i) => (
              <AppText key={i}>• {t(issue.key, issue.params)}</AppText>
            ))}
          </View>
        </Banner>
      ) : null}

      <AppText variant="caption" color="textMuted">
        {t('pack.hint')}
      </AppText>
      <View style={styles.grid}>
        {pack.stickers.map((s, i) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${t('sticker.position', { n: i + 1, total: count })} ${s.emojis.join(' ')}`}
            onPress={() => setSelected(s)}
            style={({ pressed }) => [styles.cell, { borderColor: i === 0 ? colors.primary : colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <StickerImage uri={stickerUri(pack.id, s.file)} cacheKey={s.id} size={cell - 6} />
            <AppText variant="caption" align="center" numberOfLines={1}>
              {s.emojis.join(' ')}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Button variant="danger" size="md" icon="trash-outline" label={t('pack.delete')} onPress={deletePack} style={{ marginTop: spacing.xl }} />

      {/* Sticker sheet: tags, share, reorder, delete */}
      <Sheet visible={!!current} onClose={() => setSelected(null)} title={current ? t('sticker.position', { n: index + 1, total: count }) : ''}>
        {current ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <StickerImage uri={stickerUri(pack.id, current.file)} cacheKey={current.id} size={200} />
            </View>
            <AppText variant="label">{t('sticker.tags')}</AppText>
            <EmojiPicker options={TAG_EMOJIS} selected={current.emojis} max={3} onChange={(emojis) => store.setStickerEmojis(pack.id, current.id, emojis)} />
            <Row gap={spacing.sm}>
              <Button
                size="md"
                variant="secondary"
                icon="arrow-back"
                label={t('sticker.moveEarlier')}
                disabled={index === 0}
                onPress={() => store.moveSticker(pack.id, current.id, index - 1)}
                style={{ flex: 1 }}
              />
              <Button
                size="md"
                variant="secondary"
                icon="arrow-forward"
                label={t('sticker.moveLater')}
                disabled={index === count - 1}
                onPress={() => store.moveSticker(pack.id, current.id, index + 1)}
                style={{ flex: 1 }}
              />
            </Row>
            {index > 0 ? <Button size="md" variant="ghost" icon="star-outline" label={t('sticker.makeCover')} onPress={() => store.moveSticker(pack.id, current.id, 0)} /> : null}
            <Button
              size="md"
              variant="secondary"
              icon="share-outline"
              label={t('sticker.share')}
              onPress={async () => {
                const bytes = await docStore.readBytes(packFilePath(pack.id, current.file));
                if (!bytes || !(await shareStickerImage(decodeImage(bytes), t('sticker.share')))) notify(t('common.error'));
              }}
            />
            <AppText variant="caption" color="textMuted">
              {t('sticker.shareHint')}
            </AppText>
            <Button
              size="md"
              variant="danger"
              icon="trash-outline"
              label={t('sticker.delete')}
              onPress={async () => {
                if (await confirm(t('sticker.delete'), t('sticker.deleteConfirm'), t('common.delete'), t('common.cancel'))) {
                  setSelected(null);
                  await store.deleteSticker(pack.id, current.id);
                }
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title={t('pack.renameTitle')}>
        <TextField value={nameDraft} onChangeText={setNameDraft} maxLength={WA.MAX_CHARS} autoFocus label={t('new.save.packName')} />
        <Button
          label={t('common.save')}
          disabled={!nameDraft.trim()}
          onPress={async () => {
            await store.renamePack(pack.id, nameDraft);
            setRenaming(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { borderWidth: 2, borderRadius: radius.md + 2, padding: 1, gap: 2, paddingBottom: 4 },
  headerBtn: { width: TOUCH - 8, height: TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
  added: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, minHeight: 44 },
});
