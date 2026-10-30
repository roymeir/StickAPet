import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { toFilePart } from '@/ai/filePart';
import { forgetRun, makeProvider, runStyle } from '@/ai/service';
import { AiError } from '@/ai/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Banner, ProgressBar } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Checker } from '@/components/StickerImage';
import { getStyle } from '@/config/styles';
import { useI18n } from '@/i18n/useI18n';
import { describeError } from '@/lib/errors';
import { removeBackground } from '@/native/cutout';
import { useAppStore } from '@/state/appStore';
import { cutoutCache, useDraft } from '@/state/draftStore';
import { getApiKey } from '@/storage/secrets';
import { cacheStore } from '@/storage/stores';
import { radius, spacing, useTheme } from '@/theme';

type Phase = 'painting' | 'choosing' | 'cutting' | 'error';

/** Step 3: AI restyle (with progress + cancel) → pick a variant → on-device cut-out. */
export default function GenerateScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const { colors } = useTheme();
  const source = useDraft((s) => s.source);
  const styleId = useDraft((s) => s.styleId);
  const run = useDraft((s) => s.run);
  const settings = useAppStore((s) => s.data.settings);
  const style = getStyle(styleId);

  const [phase, setPhase] = useState<Phase>(style.prompt ? 'painting' : 'cutting');
  const [error, setError] = useState<unknown>(null);
  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  // `*Inner` variants never set state before their first await, so they can start from the
  // mount effect; the wrappers below reset the UI for user-initiated retries.
  const cutInner = useCallback(
    async (inputUri: string) => {
      try {
        let cutoutUri = cutoutCache.get(inputUri);
        if (!cutoutUri) {
          cutoutUri = (await removeBackground(inputUri)).uri;
          cutoutCache.set(inputUri, cutoutUri);
        }
        const prev = useDraft.getState().base;
        const sameBase = prev?.inputUri === inputUri;
        useDraft.getState().set({ base: { inputUri, cutoutUri }, ...(sameBase ? {} : { strokes: [], edited: null }) });
        router.replace('/new/touchup');
      } catch (e) {
        setError(e);
        setPhase('error');
      }
    },
    [],
  );

  const paintInner = useCallback(
    async (force = false) => {
      if (!source) return;
      const controller = new AbortController();
      abort.current = controller;
      try {
        const provider = makeProvider(await getApiKey(), settings, toFilePart);
        if (force && run) await forgetRun(run.key, cacheStore);
        const result = await runStyle({
          photo: { uri: source.uri, mimeType: 'image/jpeg', name: 'pet.jpg' },
          photoKey: source.key,
          style,
          settings,
          provider,
          cache: cacheStore,
          signal: controller.signal,
        });
        useDraft.getState().set({ run: result });
        if (result.variants.length === 1) {
          setPhase('cutting');
          await cutInner(result.variants[0]!.uri);
        } else setPhase('choosing');
      } catch (e) {
        if (e instanceof AiError && e.kind === 'cancelled') return;
        setError(e);
        setPhase('error');
      } finally {
        abort.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, style, settings, cutInner],
  );

  const paint = (force = false) => {
    setPhase('painting');
    setError(null);
    setElapsed(0);
    void paintInner(force);
  };
  const cutAndContinue = (inputUri: string) => {
    setPhase('cutting');
    setError(null);
    void cutInner(inputUri);
  };

  useEffect(() => {
    if (!source) return;
    // Kick off after mount (in a callback, so no state update happens inside the effect body).
    void Promise.resolve().then(() => (style.prompt ? paintInner() : cutInner(source.uri)));
    return () => abort.current?.abort();
    // Run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'painting') return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const cancel = () => {
    abort.current?.abort();
    router.back();
  };

  const keyProblem = error instanceof AiError && ['missing_key', 'invalid_key', 'model_unavailable', 'org_verification'].includes(error.kind);
  // Asymptotic progress: we can't know the real progress of an image generation.
  const progress = 1 - Math.exp(-elapsed / 22);

  return (
    <Screen
      footer={
        phase === 'painting' ? (
          <Button testID="cancel-generation" label={t('common.cancel')} icon="close" variant="secondary" onPress={cancel} />
        ) : phase === 'choosing' ? (
          <Button label={t('new.generate.again')} icon="refresh" variant="ghost" onPress={() => paint(true)} />
        ) : phase === 'error' ? (
          <>
            {keyProblem ? <Button label={t('home.settings')} icon="key" onPress={() => router.push('/settings')} /> : null}
            <Button label={t('common.retry')} icon="refresh" variant={keyProblem ? 'secondary' : 'primary'} onPress={() => (style.prompt && !run ? paint() : cutAndContinue(run?.variants[0]?.uri ?? source!.uri))} />
          </>
        ) : undefined
      }
    >
      <StepHeader step={3} title={phase === 'choosing' ? t('new.generate.pick') : phase === 'cutting' ? t('new.generate.cutting') : t('new.generate.painting')} />

      {phase === 'painting' || phase === 'cutting' ? (
        <View style={styles.center}>
          {source ? <Image source={{ uri: source.uri }} style={[styles.hero, { opacity: 0.85 }]} contentFit="cover" /> : null}
          <ProgressBar progress={phase === 'cutting' ? 0.92 : progress} indeterminate />
          {phase === 'painting' ? (
            <>
              <AppText color="textMuted" align="center">
                {t('new.generate.hint')}
              </AppText>
              <AppText variant="caption" color="textMuted" align="center">
                {t('new.generate.elapsed', { seconds: elapsed })}
              </AppText>
            </>
          ) : null}
        </View>
      ) : null}

      {phase === 'choosing' && run ? (
        <>
          <View style={styles.variants}>
            {run.variants.map((v, i) => (
              <Pressable
                key={v.uri}
                accessibilityRole="button"
                accessibilityLabel={t('new.generate.option', { n: i + 1 })}
                onPress={() => cutAndContinue(v.uri)}
                style={({ pressed }) => [styles.variant, { borderColor: pressed ? colors.primary : colors.border }]}
              >
                <Checker style={styles.variantImg}>
                  <Image source={{ uri: v.uri }} style={styles.variantImg} contentFit="contain" />
                </Checker>
                <AppText variant="label" align="center">
                  {t('new.generate.option', { n: i + 1 })}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Banner tone="info">{run.cached ? t('new.generate.cached') : run.costUsd != null ? t('new.generate.cost', { cost: run.costUsd.toFixed(3) }) : t('new.generate.hint')}</Banner>
        </>
      ) : null}

      {phase === 'error' ? <Banner tone="danger">{describeError(error, i18n, settings.model)}</Banner> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.md },
  hero: { width: 240, height: 240, borderRadius: radius.xl },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  variant: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm },
  variantImg: { width: 150, height: 150 },
});
