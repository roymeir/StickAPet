import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

import { floodFillBackground } from '@/imaging/floodFill';
import { encode, loadImage, readRGBA } from '@/imaging/skia';
import { newId } from '@/lib/ids';
import { cacheStore } from '@/storage/stores';

import { PetCutout } from '../../modules/pet-cutout';

export type CutoutErrorCode = 'unsupported' | 'no_subject' | 'model_downloading' | 'failed';

export class CutoutError extends Error {
  constructor(
    readonly code: CutoutErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CutoutError';
  }
}

export interface Cutout {
  uri: string;
  width: number;
  height: number;
}

/** True when real on-device segmentation is available (iOS 17+ / Android). */
export const hasNativeCutout = () => !!PetCutout?.isSupported();

/** Android: start downloading the ML Kit model early so the first cut-out is fast. */
export function warmUpCutout() {
  void PetCutout?.prepareAsync?.().catch(() => undefined);
}

/**
 * Removes the background on device. Always run, even if an AI model already returned
 * transparency, so every sticker gets the same edge treatment.
 */
export async function removeBackground(uri: string): Promise<Cutout> {
  if (PetCutout) {
    try {
      return await PetCutout.removeBackground(uri);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const code: CutoutErrorCode =
        err.code === 'ERR_UNSUPPORTED'
          ? 'unsupported'
          : err.code === 'ERR_NO_SUBJECT'
            ? 'no_subject'
            : err.code === 'ERR_MODEL_DOWNLOADING'
              ? 'model_downloading'
              : 'failed';
      throw new CutoutError(code, err.message ?? 'Background removal failed');
    }
  }
  return removeBackgroundFallback(uri);
}

/** Web preview / tests: flood-fill a light flat background. */
async function removeBackgroundFallback(uri: string): Promise<Cutout> {
  const image = await loadImage(uri);
  const width = image.width();
  const height = image.height();
  const px = floodFillBackground(readRGBA(image), width, height);
  const out = Skia.Image.MakeImage({ width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }, Skia.Data.fromBytes(px), width * 4);
  if (!out) throw new CutoutError('failed', 'Could not build cut-out');
  const path = `cutouts/${newId()}.png`;
  await cacheStore.writeBytes(path, encode(out, 'png'));
  return { uri: cacheStore.uri(path), width, height };
}
