import { Platform } from 'react-native';

import type { Pack } from '@/domain/types';
import { bytesToBase64 } from '@/lib/base64';
import { docStore } from '@/storage/stores';

import { type PackStatus, WhatsAppStickers } from '../../modules/whatsapp-stickers';
import { buildIosPasteboardJson } from './contents';
import { readPackFiles, validatePack, type ValidationIssue } from './validator';

export type { PackStatus };

export type AddOutcome =
  | { kind: 'opened' }
  | { kind: 'added' }
  | { kind: 'cancelled' }
  | { kind: 'not_installed' }
  | { kind: 'whatsapp_rejected'; message: string }
  | { kind: 'invalid'; issues: ValidationIssue[] }
  | { kind: 'unsupported' };

export async function checkPack(pack: Pack): Promise<ValidationIssue[]> {
  return validatePack(pack, await readPackFiles(docStore, pack));
}

/**
 * "Add to WhatsApp" for one pack (WhatsApp does not allow adding several at once).
 * Android: the ContentProvider already serves the pack from contents.json (rewritten on every
 * change); we fire ENABLE_STICKER_PACK. iOS: pack JSON → pasteboard → whatsapp://stickerPack.
 */
export async function addPackToWhatsApp(pack: Pack, chooserTitle: string): Promise<AddOutcome> {
  const files = await readPackFiles(docStore, pack);
  const issues = validatePack(pack, files);
  if (issues.length) return { kind: 'invalid', issues };
  if (!WhatsAppStickers) return { kind: 'unsupported' };

  if (Platform.OS === 'android' && WhatsAppStickers.addStickerPackAsync) {
    WhatsAppStickers.notifyChanged?.();
    const res = await WhatsAppStickers.addStickerPackAsync(pack.id, pack.name, chooserTitle);
    switch (res.status) {
      case 'ok':
        return { kind: 'added' };
      case 'cancelled':
        return { kind: 'cancelled' };
      case 'not_installed':
        return { kind: 'not_installed' };
      case 'validation_error':
        return { kind: 'whatsapp_rejected', message: res.message };
    }
  }

  if (Platform.OS === 'ios' && WhatsAppStickers.sendToWhatsAppAsync) {
    const json = buildIosPasteboardJson(
      pack,
      bytesToBase64(files.tray!),
      files.stickers.map((b) => bytesToBase64(b!)),
    );
    const opened = await WhatsAppStickers.sendToWhatsAppAsync(JSON.stringify(json));
    return opened ? { kind: 'opened' } : { kind: 'not_installed' };
  }

  return { kind: 'unsupported' };
}

/** Android only: whether WhatsApp / WhatsApp Business already have this pack. */
export async function getPackStatus(packId: string): Promise<PackStatus | null> {
  if (Platform.OS !== 'android' || !WhatsAppStickers?.getPackStatusAsync) return null;
  try {
    return await WhatsAppStickers.getPackStatusAsync(packId);
  } catch {
    return null;
  }
}
