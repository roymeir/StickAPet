import type { SkImage } from '@shopify/react-native-skia';

import { parseWebp, type WebpInfo } from '@/lib/webp';
import { WA } from '@/whatsapp/limits';

import { alphaBounds, type Box } from './alpha';
import { draw, drawScaled, encode, readRGBA } from './skia';

export class StickerTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`Sticker is ${bytes} bytes even at the lowest quality`);
    this.name = 'StickerTooLargeError';
  }
}

export interface WebpExport {
  bytes: Uint8Array;
  quality: number;
  info: WebpInfo;
}

const MAX_QUALITY = 92;
const MIN_QUALITY = 5;

/**
 * Encodes a 512×512 sticker as static lossy WebP with alpha, at the highest quality that
 * stays within WhatsApp's 100 KB limit. Tries the top quality first (most stickers fit), then
 * binary-searches. The result is re-parsed to prove size, dimensions and alpha.
 */
export function encodeStickerWebp(image: SkImage, maxBytes: number = WA.STATIC_STICKER_MAX_BYTES): WebpExport {
  const attempt = (q: number) => encode(image, 'webp', q);

  let best: { bytes: Uint8Array; quality: number } | null = null;
  const top = attempt(MAX_QUALITY);
  if (top.length <= maxBytes) {
    best = { bytes: top, quality: MAX_QUALITY };
  } else {
    let lo = MIN_QUALITY;
    let hi = MAX_QUALITY - 1;
    const floor = attempt(lo);
    if (floor.length > maxBytes) throw new StickerTooLargeError(floor.length);
    best = { bytes: floor, quality: lo };
    while (hi - lo > 2) {
      const mid = Math.floor((lo + hi) / 2);
      const bytes = attempt(mid);
      if (bytes.length <= maxBytes) {
        best = { bytes, quality: mid };
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
  }

  const info = parseWebp(best.bytes);
  if (!info) throw new Error('Encoder did not produce a WebP file');
  if (info.width !== WA.STICKER_SIZE || info.height !== WA.STICKER_SIZE) {
    throw new Error(`Sticker must be 512×512, got ${info.width}×${info.height}`);
  }
  if (!info.hasAlpha) throw new Error('Sticker WebP has no alpha channel');
  if (info.animated) throw new Error('Sticker WebP must be static');
  return { ...best, info };
}

/**
 * 96×96 PNG tray icon. The sticker art is cropped to its visible bounds (plus a little air) so
 * the icon is not mostly empty margin.
 */
export function renderTrayPng(sticker: SkImage): Uint8Array {
  const size = WA.TRAY_SIZE;
  const bounds: Box = alphaBounds(readRGBA(sticker), sticker.width(), sticker.height()) ?? {
    x: 0,
    y: 0,
    width: sticker.width(),
    height: sticker.height(),
  };
  const side = Math.max(bounds.width, bounds.height) * 1.08;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const src = { x: cx - side / 2, y: cy - side / 2, width: side, height: side };
  const pad = 2;
  const icon = draw(size, size, (c) => drawScaled(c, sticker, src, { x: pad, y: pad, width: size - 2 * pad, height: size - 2 * pad }));
  const png = encode(icon, 'png');
  if (png.length > WA.TRAY_MAX_BYTES) throw new Error(`Tray icon is ${png.length} bytes`);
  return png;
}
