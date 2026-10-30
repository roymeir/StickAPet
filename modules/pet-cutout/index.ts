import { requireOptionalNativeModule } from 'expo';

export interface CutoutResult {
  /** file:// URI of a PNG with a transparent background, same size as the input. */
  uri: string;
  width: number;
  height: number;
}

interface PetCutoutNative {
  /** iOS: true on iOS 17+. Android: always true (the model may still need to download). */
  isSupported(): boolean;
  /** Android only: asks Google Play services to download the segmentation model now. */
  prepareAsync?(): Promise<boolean>;
  /**
   * Rejects with codes: ERR_UNSUPPORTED (iOS < 17), ERR_NO_SUBJECT, ERR_MODEL_DOWNLOADING
   * (Android, model not yet downloaded), ERR_CUTOUT (anything else).
   */
  removeBackground(uri: string): Promise<CutoutResult>;
}

/** null on platforms without the native module (web preview, unit tests). */
export const PetCutout = requireOptionalNativeModule<PetCutoutNative>('PetCutout');
