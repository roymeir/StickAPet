import { parsePngSize, parseWebp } from '@/lib/webp';
import { WA } from '@/whatsapp/limits';

import { alphaBounds, hasVisiblePixelsInBorder } from '../alpha';
import { composeSticker } from '../compose';
import { encodeStickerWebp, renderTrayPng } from '../exportWebp';
import { decodeImage, draw, readRGBA } from '../skia';
import { ellipseCutout, loadFixture, loadTestFonts, makeNoisyCutout } from '@/testing/fixtures';

describe('sticker export (real Skia via CanvasKit)', () => {
  const fonts = loadTestFonts();

  it('produces a 512×512 WebP with alpha under 100 KB for a real photo cut-out', () => {
    const cutout = ellipseCutout(loadFixture('assets/test/chelsea-cat.png'));
    const { image } = composeSticker(cutout, { outlinePct: 0.04, shadow: true }, fonts);
    expect(image.width()).toBe(512);
    expect(image.height()).toBe(512);

    const out = encodeStickerWebp(image);
    expect(out.bytes.length).toBeLessThanOrEqual(WA.STATIC_STICKER_MAX_BYTES);

    const info = parseWebp(out.bytes)!;
    expect(info).toMatchObject({ width: 512, height: 512, hasAlpha: true, animated: false });

    // Decode what we wrote and check the actual pixels.
    const decoded = decodeImage(out.bytes);
    const px = readRGBA(decoded);
    const corner = px[3]; // alpha of (0,0)
    expect(corner).toBe(0);
    expect(hasVisiblePixelsInBorder(px, 512, 512, WA.STICKER_MARGIN)).toBe(false);
    const center = (256 * 512 + 256) * 4 + 3;
    expect(px[center]).toBe(255);
  });

  it('lowers the quality until a worst-case noisy sticker fits in 100 KB', () => {
    // Full-range RGB noise is far busier than any fur; at top quality it is well over 100 KB.
    const { image } = composeSticker(makeNoisyCutout(520, 520, 9, true, true), { outlinePct: 0.02, shadow: true }, fonts);
    const out = encodeStickerWebp(image);
    expect(out.bytes.length).toBeLessThanOrEqual(100 * 1024);
    expect(out.quality).toBeLessThan(92);
    expect(out.info.hasAlpha).toBe(true);
  });

  it('respects a tighter byte budget by trading quality', () => {
    const { image } = composeSticker(makeNoisyCutout(600, 600, 3), { outlinePct: 0.03, shadow: false }, fonts);
    const loose = encodeStickerWebp(image, 100 * 1024);
    const tight = encodeStickerWebp(image, 40 * 1024);
    expect(tight.bytes.length).toBeLessThanOrEqual(40 * 1024);
    expect(tight.quality).toBeLessThanOrEqual(loose.quality);
  });

  it('adds a white outline about as thick as requested', () => {
    const cutout = makeNoisyCutout(400, 400, 11);
    const thin = composeSticker(cutout, { outlinePct: 0, shadow: false }, fonts);
    const thick = composeSticker(cutout, { outlinePct: 0.05, shadow: false }, fonts);
    const bThick = alphaBounds(readRGBA(thick.image), 512, 512)!;
    // The art is scaled to the same safe area, so the subject shrinks to make room for the outline:
    expect(thick.subject.width).toBeLessThan(thin.subject.width);
    // ...and the visible extent grows by roughly the outline on each side (0.05 × 512 ≈ 26 px).
    const growth = (bThick.width - thick.subject.width) / 2;
    expect(growth).toBeGreaterThan(18);
    expect(growth).toBeLessThan(32);
    // Outline pixels are white.
    const px = readRGBA(thick.image);
    const y = Math.round(thick.subject.y + thick.subject.height * 0.6);
    let x = 0;
    while (x < 512 && px[(y * 512 + x) * 4 + 3]! < 250) x++;
    const i = (y * 512 + x + 2) * 4;
    expect(px[i]).toBeGreaterThan(245);
    expect(px[i + 1]).toBeGreaterThan(245);
    expect(px[i + 2]).toBeGreaterThan(245);
  });

  it('keeps Hebrew and English captions inside the margin', () => {
    const cutout = makeNoisyCutout(500, 500, 5);
    for (const caption of ['בוקר טוב!', 'Good morning sunshine', 'אוהבת אותך הכי בעולם, ממש ממש']) {
      const r = composeSticker(cutout, { outlinePct: 0.04, shadow: true, caption }, fonts);
      expect(r.caption).not.toBeNull();
      const px = readRGBA(r.image);
      expect(hasVisiblePixelsInBorder(px, 512, 512, WA.STICKER_MARGIN)).toBe(false);
      // The caption sits in the lower part of the sticker.
      expect(r.caption!.y).toBeGreaterThan(256);
      expect(encodeStickerWebp(r.image).bytes.length).toBeLessThanOrEqual(100 * 1024);
    }
  });

  it('renders a 96×96 PNG tray icon under 50 KB', () => {
    const { image } = composeSticker(makeNoisyCutout(), { outlinePct: 0.04, shadow: true }, fonts);
    const png = renderTrayPng(image);
    expect(png.length).toBeLessThanOrEqual(WA.TRAY_MAX_BYTES);
    expect(parsePngSize(png)).toEqual({ width: 96, height: 96 });
  });

  it('rejects an empty cut-out', () => {
    const empty = draw(32, 32, () => {});
    expect(() => composeSticker(empty, { outlinePct: 0.04, shadow: true }, fonts)).toThrow('EMPTY_CUTOUT');
  });
});
