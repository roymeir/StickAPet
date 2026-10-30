import type { SkImage } from '@shopify/react-native-skia';
import * as Sharing from 'expo-sharing';

import { encode } from '@/imaging/skia';
import { newId } from '@/lib/ids';
import { cacheStore } from '@/storage/stores';

/**
 * Fallback path: share one sticker as a transparent PNG through the system share sheet.
 * WhatsApp's own "create sticker" feature can take it from there.
 */
export async function shareStickerImage(image: SkImage, dialogTitle: string): Promise<boolean> {
  const path = `share/sticker-${newId()}.png`;
  await cacheStore.writeBytes(path, encode(image, 'png'));
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(cacheStore.uri(path), { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
  return true;
}
