import {
  AlphaType,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia';

/** CPU raster surface: deterministic, readable and encodable on every platform. */
export function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.Make(Math.round(width), Math.round(height));
  if (!surface) throw new Error(`Could not create a ${width}×${height} surface`);
  return surface;
}

export function snapshot(surface: SkSurface): SkImage {
  surface.flush();
  const image = surface.makeImageSnapshot();
  return image.makeNonTextureImage?.() ?? image;
}

export function draw(width: number, height: number, fn: (canvas: SkCanvas) => void): SkImage {
  const surface = makeSurface(width, height);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  fn(canvas);
  return snapshot(surface);
}

export function decodeImage(bytes: Uint8Array): SkImage {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) throw new Error('Could not decode image');
  return image;
}

export async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`Could not decode image: ${uri.slice(0, 80)}`);
  return image;
}

/** Straight (unpremultiplied) RGBA8888 pixels. */
export function readRGBA(image: SkImage): Uint8Array {
  const width = image.width();
  const height = image.height();
  const px = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!px || !(px instanceof Uint8Array)) throw new Error('Could not read pixels');
  return px;
}

export function encode(image: SkImage, format: 'png' | 'webp' | 'jpeg', quality = 100): Uint8Array {
  const fmt = format === 'png' ? ImageFormat.PNG : format === 'webp' ? ImageFormat.WEBP : ImageFormat.JPEG;
  const bytes = image.encodeToBytes(fmt, quality);
  if (!bytes || bytes.length === 0) throw new Error(`Could not encode ${format}`);
  return bytes;
}

/** High-quality resampled draw of `src` rect of `image` into `dst` rect. */
export function drawScaled(
  canvas: SkCanvas,
  image: SkImage,
  src: { x: number; y: number; width: number; height: number },
  dst: { x: number; y: number; width: number; height: number },
) {
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(src.x, src.y, src.width, src.height),
    Skia.XYWHRect(dst.x, dst.y, dst.width, dst.height),
    FilterMode.Linear,
    MipmapMode.Linear,
    null,
  );
}
