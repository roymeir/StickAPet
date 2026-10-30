import { Canvas, Group, Image as SkiaImage, Path, type SkImage } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, type GestureResponderEvent, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Banner, Chip, Row, Segmented } from '@/components/Primitives';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Checker } from '@/components/StickerImage';
import { useI18n } from '@/i18n/useI18n';
import { loadImage } from '@/imaging/skia';
import { applyStrokes, type BrushMode, type Stroke, strokeToPath } from '@/imaging/touchup';
import { describeError } from '@/lib/errors';
import { useDraft } from '@/state/draftStore';
import { spacing } from '@/theme';

const BRUSHES = { small: 14, medium: 28, large: 48 } as const;
type BrushSize = keyof typeof BRUSHES;

/** Step 4: erase / restore brush with undo, over the cut-out. */
export default function TouchUpScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const base = useDraft((s) => s.base);
  const strokes = useDraft((s) => s.strokes);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [images, setImages] = useState<{ cutout: SkImage; original: SkImage } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [mode, setMode] = useState<BrushMode>('erase');
  const [brush, setBrush] = useState<BrushSize>('medium');
  const [live, setLive] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!base) return;
    let alive = true;
    Promise.all([loadImage(base.cutoutUri), loadImage(base.inputUri)])
      .then(([cutout, original]) => alive && setImages({ cutout, original }))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [base]);

  // Fit the image into a square canvas. The screen doesn't scroll (so strokes never fight a
  // ScrollView), hence the height budget for header, tools and footer.
  const canvasSize = Math.max(200, Math.min(screenW - spacing.lg * 2, screenH - 470, 460));
  const layout = useMemo(() => {
    if (!images) return null;
    const w = images.cutout.width();
    const h = images.cutout.height();
    const scale = Math.min(canvasSize / w, canvasSize / h);
    return { w, h, scale, ox: (canvasSize - w * scale) / 2, oy: (canvasSize - h * scale) / 2 };
  }, [images, canvasSize]);

  // Gestures in screen points → image pixels (responder props; refs are only read in handlers).
  const points = useRef<number[]>([]);
  const toImage = (e: GestureResponderEvent): [number, number] => {
    const { locationX, locationY } = e.nativeEvent;
    return [(locationX - layout!.ox) / layout!.scale, (locationY - layout!.oy) / layout!.scale];
  };
  const touch = {
    onStartShouldSetResponder: () => !!layout,
    onMoveShouldSetResponder: () => !!layout,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      points.current = toImage(e);
      setLive([...points.current]);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      points.current.push(...toImage(e));
      setLive([...points.current]);
    },
    onResponderRelease: () => {
      if (layout && points.current.length >= 2) {
        const stroke: Stroke = { mode, width: BRUSHES[brush] / layout.scale, points: points.current };
        useDraft.getState().set({ strokes: [...useDraft.getState().strokes, stroke] });
      }
      points.current = [];
      setLive(null);
    },
  };

  const done = async () => {
    if (!images) return;
    setBusy(true);
    try {
      useDraft.getState().set({ edited: applyStrokes(images.cutout, images.original, strokes) });
      router.push('/new/finish');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const allStrokes = live && layout ? [...strokes, { mode, width: BRUSHES[brush] / layout.scale, points: live }] : strokes;

  return (
    <Screen
      scroll={false}
      footer={<Button testID="touchup-done" label={t('common.next')} icon="arrow-forward" onPress={done} loading={busy} disabled={!images} />}
    >
      <StepHeader step={4} title={t('new.touchup.title')} />
      <AppText color="textMuted">{t('new.touchup.hint')}</AppText>

      <View style={{ alignItems: 'center' }}>
        <Checker style={{ width: canvasSize, height: canvasSize }}>
          {images && layout ? (
            <View {...touch} style={{ width: canvasSize, height: canvasSize }} accessibilityLabel={t('new.touchup.title')}>
              <Canvas style={{ width: canvasSize, height: canvasSize }}>
                <Group transform={[{ translateX: layout.ox }, { translateY: layout.oy }, { scale: layout.scale }]}>
                  <Group layer>
                    <SkiaImage image={images.cutout} x={0} y={0} width={layout.w} height={layout.h} />
                    {allStrokes.map((s, i) =>
                      s.mode === 'erase' ? (
                        <Path key={i} path={strokeToPath(s.points)} style="stroke" strokeWidth={s.width} strokeCap="round" strokeJoin="round" blendMode="clear" color="black" />
                      ) : (
                        <Group key={i} layer>
                          <Path path={strokeToPath(s.points)} style="stroke" strokeWidth={s.width} strokeCap="round" strokeJoin="round" color="black" />
                          <SkiaImage image={images.original} x={0} y={0} width={layout.w} height={layout.h} blendMode="srcIn" />
                        </Group>
                      ),
                    )}
                  </Group>
                </Group>
              </Canvas>
            </View>
          ) : error ? null : (
            <ActivityIndicator size="large" />
          )}
        </Checker>
      </View>

      <Segmented<BrushMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'erase', label: t('new.touchup.erase') },
          { value: 'restore', label: t('new.touchup.restore') },
        ]}
      />
      <Row style={{ flexWrap: 'wrap' }} gap={spacing.sm}>
        <AppText variant="label">{t('new.touchup.brush')}</AppText>
        {(Object.keys(BRUSHES) as BrushSize[]).map((b) => (
          <Chip key={b} label={t(`new.touchup.${b}`)} selected={brush === b} onPress={() => setBrush(b)} accessibilityLabel={t('new.touchup.brushSize', { size: t(`new.touchup.${b}`) })} />
        ))}
      </Row>
      <Row gap={spacing.sm}>
        <Button
          size="md"
          variant="secondary"
          icon="arrow-undo"
          label={t('new.touchup.undo')}
          disabled={strokes.length === 0}
          onPress={() => useDraft.getState().set({ strokes: strokes.slice(0, -1) })}
          style={{ flex: 1 }}
        />
        <Button
          size="md"
          variant="ghost"
          icon="refresh"
          label={t('new.touchup.reset')}
          disabled={strokes.length === 0}
          onPress={() => useDraft.getState().set({ strokes: [] })}
          style={{ flex: 1 }}
        />
      </Row>
      {error ? <Banner tone="danger">{describeError(error, i18n)}</Banner> : null}
    </Screen>
  );
}

