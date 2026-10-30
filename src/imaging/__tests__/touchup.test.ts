import { Skia } from '@shopify/react-native-skia';

import { draw, readRGBA } from '../skia';
import { applyStrokes } from '../touchup';

const W = 100;
const solid = (color: string) => draw(W, W, (c) => c.drawColor(Skia.Color(color)));
const alphaAt = (px: Uint8Array, x: number, y: number) => px[(y * W + x) * 4 + 3]!;

describe('touch-up brush', () => {
  // Cut-out: left half visible (red), right half transparent. Original photo: all blue.
  const cutout = draw(W, W, (c) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color('red'));
    c.drawRect(Skia.XYWHRect(0, 0, W / 2, W), p);
  });
  const original = solid('blue');

  it('erase clears alpha along the stroke', () => {
    const px = readRGBA(applyStrokes(cutout, original, [{ mode: 'erase', width: 10, points: [10, 50, 40, 50] }]));
    expect(alphaAt(px, 25, 50)).toBe(0);
    expect(alphaAt(px, 25, 20)).toBe(255);
  });

  it('restore paints the original pixels back', () => {
    const px = readRGBA(applyStrokes(cutout, original, [{ mode: 'restore', width: 10, points: [60, 50, 90, 50] }]));
    const i = (50 * W + 75) * 4;
    expect(px[i + 3]).toBe(255);
    expect(px[i + 2]).toBeGreaterThan(200); // blue from the original
    expect(alphaAt(px, 75, 20)).toBe(0); // untouched area stays transparent
  });

  it('applies strokes in order (restore after erase wins)', () => {
    const px = readRGBA(
      applyStrokes(cutout, original, [
        { mode: 'erase', width: 20, points: [25, 50, 25, 50] },
        { mode: 'restore', width: 6, points: [25, 50, 25, 50] },
      ]),
    );
    expect(alphaAt(px, 25, 50)).toBe(255);
    expect(alphaAt(px, 25, 58)).toBe(0);
  });

  it('returns the cut-out unchanged with no strokes', () => {
    expect(applyStrokes(cutout, original, [])).toBe(cutout);
  });
});
