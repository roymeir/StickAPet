import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_SOURCE_SIDE = 1024;

export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Downscales a picked photo so its longest side is at most 1024px and re-encodes it as JPEG.
 * This also bakes in the EXIF orientation, so every later step sees upright pixels.
 */
export async function preparePhoto(uri: string, width?: number, height?: number): Promise<PreparedPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > MAX_SOURCE_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SOURCE_SIDE } : { height: MAX_SOURCE_SIDE });
  }
  const image = await ctx.renderAsync();
  if (!width || !height) {
    // Size unknown up front (e.g. web): resize after rendering once.
    if (Math.max(image.width, image.height) > MAX_SOURCE_SIDE) {
      const second = ImageManipulator.manipulate(image);
      second.resize(image.width >= image.height ? { width: MAX_SOURCE_SIDE } : { height: MAX_SOURCE_SIDE });
      const resized = await second.renderAsync();
      const out = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      return { uri: out.uri, width: out.width, height: out.height };
    }
  }
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: out.uri, width: out.width, height: out.height };
}
