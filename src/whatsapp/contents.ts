import type { Pack } from '@/domain/types';

import { WA } from './limits';

/** Where the Android ContentProvider expects things (relative to the doc store root). */
export const WHATSAPP_MANIFEST_PATH = 'whatsapp/contents.json';
export const packDir = (packId: string) => `packs/${packId}`;
export const packFilePath = (packId: string, file: string) => `${packDir(packId)}/${file}`;

/**
 * Builds the `contents.json` that our Android ContentProvider serves to WhatsApp.
 * Same schema as the official sample's assets/contents.json, so the native side stays a thin
 * port of the sample's ContentFileParser. Packs with no stickers or no tray are left out —
 * WhatsApp would reject them anyway.
 */
export function buildContentsJson(packs: Pack[]) {
  return {
    sticker_packs: packs
      .filter((p) => p.stickers.length > 0 && p.trayFile)
      .map((p) => ({
        identifier: p.id,
        name: p.name,
        publisher: p.publisher,
        tray_image_file: p.trayFile!,
        image_data_version: String(p.imageDataVersion),
        avoid_cache: false,
        animated_sticker_pack: false,
        publisher_email: '',
        publisher_website: '',
        privacy_policy_website: '',
        license_agreement_website: '',
        stickers: p.stickers.map((s) => ({
          image_file: s.file,
          emojis: s.emojis.slice(0, WA.EMOJI_MAX),
          accessibility_text: accessibilityText(s),
        })),
      })),
  };
}

/**
 * iOS: the JSON that goes on the pasteboard (`net.whatsapp.third-party.sticker-pack`).
 * Format from the iOS README: tray_image = base64 PNG, image_data = base64 WebP.
 */
export function buildIosPasteboardJson(
  pack: Pack,
  trayPngBase64: string,
  stickerWebpBase64: string[],
) {
  return {
    identifier: pack.id,
    name: pack.name,
    publisher: pack.publisher,
    tray_image: trayPngBase64,
    stickers: pack.stickers.map((s, i) => ({
      image_data: stickerWebpBase64[i]!,
      emojis: s.emojis.slice(0, WA.EMOJI_MAX),
      accessibility_text: accessibilityText(s),
    })),
  };
}

/** WhatsApp asks for US-English accessibility text, at most 125 chars for static stickers. */
export function accessibilityText(s: Pick<Pack['stickers'][number], 'caption'>): string {
  const base = 'A pet sticker';
  const text = s.caption?.trim() ? `${base} with text that reads "${s.caption.trim()}"` : base;
  return text.length > WA.STATIC_A11Y_MAX_CHARS ? `${text.slice(0, WA.STATIC_A11Y_MAX_CHARS - 2)}"` : text;
}
