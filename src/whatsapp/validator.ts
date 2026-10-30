import type { Pack } from '@/domain/types';
import type { StringKey } from '@/i18n/en';
import { parsePngSize, parseWebp } from '@/lib/webp';
import type { FileStore } from '@/storage/fileStore';

import { packFilePath } from './contents';
import { WA } from './limits';

export interface ValidationIssue {
  key: StringKey;
  params?: Record<string, string | number>;
}

export interface PackFiles {
  tray: Uint8Array | null;
  /** Same order as pack.stickers. */
  stickers: (Uint8Array | null)[];
}

/**
 * Checks a pack against WhatsApp's rules, mirroring the official Android sample's
 * StickerPackValidator (plus the iOS sample's Limits). Works on the actual file bytes we would
 * hand to WhatsApp. Returns [] when the pack is ready.
 */
export function validatePack(pack: Pick<Pack, 'id' | 'name' | 'publisher' | 'stickers' | 'trayFile'>, files: PackFiles): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (key: StringKey, params?: ValidationIssue['params']) => issues.push({ key, params });

  // Identifier: non-empty, ≤128 chars, [a-zA-Z0-9_-.,' ] and no "..".
  if (!pack.id || pack.id.length > WA.MAX_CHARS || !WA.IDENTIFIER_PATTERN.test(pack.id) || pack.id.includes('..')) {
    add('wa.identifierInvalid');
  }
  if (!pack.name.trim()) add('wa.nameEmpty');
  else if (pack.name.length > WA.MAX_CHARS) add('wa.nameTooLong', { max: WA.MAX_CHARS });
  if (!pack.publisher.trim()) add('wa.publisherEmpty');
  else if (pack.publisher.length > WA.MAX_CHARS) add('wa.publisherTooLong', { max: WA.MAX_CHARS });

  // Tray icon: present, PNG, ≤50 KB, between 24 and 512 px (we always make 96×96).
  if (!pack.trayFile || !files.tray) {
    add('wa.trayMissing');
  } else {
    if (files.tray.length > WA.TRAY_MAX_BYTES) add('wa.trayTooBig', { max: WA.TRAY_MAX_BYTES / 1024 });
    const size = parsePngSize(files.tray);
    if (!size || size.width < WA.TRAY_DIMENSION_MIN || size.width > WA.TRAY_DIMENSION_MAX || size.height < WA.TRAY_DIMENSION_MIN || size.height > WA.TRAY_DIMENSION_MAX) {
      add('wa.trayDimensions', { width: size?.width ?? 0, height: size?.height ?? 0 });
    }
  }

  const count = pack.stickers.length;
  if (count < WA.MIN_STICKERS) add('wa.tooFew', { min: WA.MIN_STICKERS, count });
  if (count > WA.MAX_STICKERS) add('wa.tooMany', { max: WA.MAX_STICKERS, count });

  pack.stickers.forEach((sticker, i) => {
    const n = i + 1;
    if (sticker.emojis.length < WA.EMOJI_MIN) add('wa.emojiMissing', { n });
    if (sticker.emojis.length > WA.EMOJI_MAX) add('wa.emojiTooMany', { n, max: WA.EMOJI_MAX });
    const bytes = files.stickers[i];
    if (!bytes) {
      add('wa.fileMissing', { n });
      return;
    }
    if (bytes.length > WA.STATIC_STICKER_MAX_BYTES) add('wa.stickerTooBig', { n, max: WA.STATIC_STICKER_MAX_BYTES / 1024 });
    const info = parseWebp(bytes);
    if (!info) {
      add('wa.stickerNotWebp', { n });
      return;
    }
    if (info.width !== WA.STICKER_SIZE || info.height !== WA.STICKER_SIZE) add('wa.stickerDimensions', { n, width: info.width, height: info.height });
    // A pack must not mix static and animated stickers; ours are static.
    if (info.animated) add('wa.stickerAnimated', { n });
    if (!info.hasAlpha) add('wa.stickerNoAlpha', { n });
  });

  return issues;
}

export async function readPackFiles(store: FileStore, pack: Pick<Pack, 'id' | 'stickers' | 'trayFile'>): Promise<PackFiles> {
  const [tray, ...stickers] = await Promise.all([
    pack.trayFile ? store.readBytes(packFilePath(pack.id, pack.trayFile)) : Promise.resolve(null),
    ...pack.stickers.map((s) => store.readBytes(packFilePath(pack.id, s.file))),
  ]);
  return { tray: tray ?? null, stickers };
}
