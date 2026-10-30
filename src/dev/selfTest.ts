import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { alphaBounds, hasVisiblePixelsInBorder } from '@/imaging/alpha';
import { composeSticker } from '@/imaging/compose';
import { encodeStickerWebp, renderTrayPng } from '@/imaging/exportWebp';
import { loadStickerFonts } from '@/imaging/fonts';
import { preparePhoto } from '@/imaging/prepare';
import { decodeImage, loadImage, readRGBA } from '@/imaging/skia';
import { parsePngSize } from '@/lib/webp';
import { hasNativeCutout, removeBackground } from '@/native/cutout';
import { WA } from '@/whatsapp/limits';

export interface SelfTestReport {
  ok: boolean;
  lines: string[];
}

/**
 * Runs the Classic pipeline on the bundled CC0 test photo, on this device, and checks every
 * WhatsApp rule on the result. Settings → Diagnostics. (Milestone 2's on-device verification.)
 */
export async function runSelfTest(): Promise<SelfTestReport> {
  const lines: string[] = [`Platform: ${Platform.OS} ${Platform.Version ?? ''}`, `Native cut-out: ${hasNativeCutout() ? 'yes' : 'no (fallback)'}`];
  let ok = true;
  const check = (label: string, pass: boolean, detail = '') => {
    ok &&= pass;
    lines.push(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  };
  try {
    const asset = Asset.fromModule(require('../../assets/test/chelsea-cat.png'));
    await asset.downloadAsync();
    const photo = await preparePhoto(asset.localUri ?? asset.uri, asset.width ?? undefined, asset.height ?? undefined);
    check('Photo prepared', Math.max(photo.width, photo.height) <= 1024, `${photo.width}×${photo.height}`);

    const t0 = Date.now();
    const cut = await removeBackground(photo.uri);
    const cutImage = await loadImage(cut.uri);
    const px = readRGBA(cutImage);
    const box = alphaBounds(px, cutImage.width(), cutImage.height());
    check('Background removed', !!box, `${Date.now() - t0} ms, subject ${box ? `${box.width}×${box.height}` : 'none'}`);

    const fonts = await loadStickerFonts();
    const t1 = Date.now();
    const { image } = composeSticker(cutImage, { outlinePct: 0.04, shadow: true, caption: 'שלום! Hello' }, fonts);
    const webp = encodeStickerWebp(image);
    check('WebP is 512×512', webp.info.width === 512 && webp.info.height === 512);
    check('WebP has alpha', webp.info.hasAlpha);
    check('WebP is static', !webp.info.animated);
    check('WebP ≤ 100 KB', webp.bytes.length <= WA.STATIC_STICKER_MAX_BYTES, `${(webp.bytes.length / 1024).toFixed(1)} KB @ q${webp.quality}, ${Date.now() - t1} ms`);
    const decoded = readRGBA(decodeImage(webp.bytes));
    check('16 px margin is transparent', !hasVisiblePixelsInBorder(decoded, 512, 512, WA.STICKER_MARGIN));
    const tray = renderTrayPng(image);
    const traySize = parsePngSize(tray);
    check('Tray icon 96×96 PNG ≤ 50 KB', traySize?.width === 96 && traySize.height === 96 && tray.length <= WA.TRAY_MAX_BYTES, `${(tray.length / 1024).toFixed(1)} KB`);
    check('Caption font loaded', !!fonts);
  } catch (e) {
    check('Pipeline', false, e instanceof Error ? e.message : String(e));
  }
  return { ok, lines };
}
