import * as fs from 'fs';
import * as path from 'path';

import { AlphaType, ClipOp, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';

import type { StickerFonts } from '@/imaging/compose';
import { decodeImage, draw } from '@/imaging/skia';

export const ROOT = path.resolve(__dirname, '../..');

export function loadFixture(rel: string): SkImage {
  return decodeImage(new Uint8Array(fs.readFileSync(path.join(ROOT, rel))));
}

export function loadTestFonts(): StickerFonts {
  const bytes = fs.readFileSync(path.join(ROOT, 'node_modules/@expo-google-fonts/rubik/800ExtraBold/Rubik_800ExtraBold.ttf'));
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(bytes)));
  if (!typeface) throw new Error('font');
  const provider = Skia.TypefaceFontProvider.Make();
  provider.registerFont(typeface, 'Rubik');
  return { provider, family: 'Rubik' };
}

/** Deterministic pseudo-random noise so "photo-like" fixtures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A fake cut-out: a cat-ish head (circle + two ear triangles) on transparency, filled with
 * per-pixel noise so it compresses like the furriest photo imaginable (worst case for size).
 */
export function makeNoisyCutout(width = 900, height = 800, seed = 7, fullRange = false, square = false): SkImage {
  const rand = rng(seed);
  const px = new Uint8Array(width * height * 4);
  const cx = width / 2;
  const cy = height * 0.58;
  const r = Math.min(width, height) * 0.33;
  const inTri = (x: number, y: number, a: number[], b: number[], c: number[]) => {
    const s1 = (b[0]! - a[0]!) * (y - a[1]!) - (b[1]! - a[1]!) * (x - a[0]!);
    const s2 = (c[0]! - b[0]!) * (y - b[1]!) - (c[1]! - b[1]!) * (x - b[0]!);
    const s3 = (a[0]! - c[0]!) * (y - c[1]!) - (a[1]! - c[1]!) * (x - c[0]!);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  const earL = [[width * 0.26, height * 0.42], [width * 0.3, height * 0.08], [width * 0.45, height * 0.3]] as const;
  const earR = [[width * 0.74, height * 0.42], [width * 0.7, height * 0.08], [width * 0.55, height * 0.3]] as const;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside =
        square ||
        (x - cx) ** 2 + (y - cy) ** 2 <= r * r ||
        inTri(x, y, [...earL[0]], [...earL[1]], [...earL[2]]) ||
        inTri(x, y, [...earR[0]], [...earR[1]], [...earR[2]]);
      const i = (y * width + x) * 4;
      if (!inside) continue;
      px[i] = fullRange ? rand() * 256 : 120 + rand() * 135;
      px[i + 1] = fullRange ? rand() * 256 : 70 + rand() * 120;
      px[i + 2] = fullRange ? rand() * 256 : 30 + rand() * 90;
      px[i + 3] = 255;
    }
  }
  const image = Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(px),
    width * 4,
  );
  if (!image) throw new Error('MakeImage failed');
  return image;
}

/** Cuts an ellipse out of a photo — a stand-in for native segmentation in unit tests. */
export function ellipseCutout(photo: SkImage): SkImage {
  const w = photo.width();
  const h = photo.height();
  return draw(w, h, (c) => {
    c.clipPath(Skia.Path.Oval(Skia.XYWHRect(w * 0.12, h * 0.05, w * 0.7, h * 0.9)), ClipOp.Intersect, true);
    c.drawImage(photo, 0, 0);
  });
}
