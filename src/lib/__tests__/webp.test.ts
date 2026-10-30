import sharp from 'sharp';

import { parsePngSize, parseWebp } from '../webp';

const rgba = (w: number, h: number, alpha: number) => ({ create: { width: w, height: h, channels: 4 as const, background: { r: 200, g: 100, b: 50, alpha } } });

describe('parseWebp', () => {
  it('reads lossy WebP without alpha (VP8)', async () => {
    const bytes = new Uint8Array(await sharp({ create: { width: 64, height: 32, channels: 3, background: '#f80' } }).webp({ quality: 80 }).toBuffer());
    expect(parseWebp(bytes)).toMatchObject({ kind: 'VP8 ', width: 64, height: 32, hasAlpha: false, animated: false });
  });

  it('reads lossy WebP with alpha (VP8X + ALPH)', async () => {
    const bytes = new Uint8Array(await sharp(rgba(512, 512, 0.5)).webp({ quality: 80 }).toBuffer());
    expect(parseWebp(bytes)).toMatchObject({ kind: 'VP8X', width: 512, height: 512, hasAlpha: true, animated: false });
  });

  it('reads lossless WebP with alpha (VP8L)', async () => {
    const bytes = new Uint8Array(await sharp(rgba(100, 80, 0.5)).webp({ lossless: true }).toBuffer());
    const info = parseWebp(bytes)!;
    expect(info.width).toBe(100);
    expect(info.height).toBe(80);
    expect(info.hasAlpha).toBe(true);
  });

  it('detects animated WebP', async () => {
    // Two different frames (identical frames get merged into a still image).
    const red = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    const blue = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 200, alpha: 1 } } }).png().toBuffer();
    const sheet = await sharp([red, blue], { join: { animated: true } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect(parseWebp(new Uint8Array(sheet))).toMatchObject({ animated: true, width: 32, height: 32 });
  });

  it('rejects non-WebP data', () => {
    expect(parseWebp(new Uint8Array(64))).toBeNull();
  });

  it('reads PNG dimensions', async () => {
    const png = new Uint8Array(await sharp(rgba(96, 96, 1)).png().toBuffer());
    expect(parsePngSize(png)).toEqual({ width: 96, height: 96 });
  });
});
