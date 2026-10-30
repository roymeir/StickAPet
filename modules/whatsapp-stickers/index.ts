import { requireOptionalNativeModule } from 'expo';

export interface PackStatus {
  consumerInstalled: boolean;
  businessInstalled: boolean;
  /** null when the app isn't installed or is too old to answer. */
  consumerAdded: boolean | null;
  businessAdded: boolean | null;
}

export type AddResult =
  | { status: 'ok' }
  | { status: 'cancelled' }
  | { status: 'validation_error'; message: string }
  | { status: 'not_installed' };

interface WhatsAppStickersNative {
  // Android
  getContentProviderAuthority?(): string;
  getPackStatusAsync?(identifier: string): Promise<PackStatus>;
  addStickerPackAsync?(identifier: string, name: string, chooserTitle: string): Promise<AddResult>;
  /** Tells observers (WhatsApp) that contents.json changed. */
  notifyChanged?(): void;
  // iOS: resolves false when WhatsApp isn't installed.
  sendToWhatsAppAsync?(json: string): Promise<boolean>;
}

/** null on platforms without the native module (web preview, unit tests). */
export const WhatsAppStickers = requireOptionalNativeModule<WhatsAppStickersNative>('WhatsAppStickers');
