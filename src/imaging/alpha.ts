export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounding box of all pixels whose alpha is above `threshold`, from straight RGBA bytes.
 * Returns null for a fully transparent image.
 */
export function alphaBounds(rgba: Uint8Array, width: number, height: number, threshold = 12): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    let row = y * width * 4 + 3;
    for (let x = 0; x < width; x++, row += 4) {
      if (rgba[row]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Fraction of pixels with alpha above `threshold` (0..1). */
export function alphaCoverage(rgba: Uint8Array, threshold = 12): number {
  let n = 0;
  const total = rgba.length / 4;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! > threshold) n++;
  return total ? n / total : 0;
}

/** True if any pixel inside the given border band is visible (used to check sticker margins). */
export function hasVisiblePixelsInBorder(rgba: Uint8Array, width: number, height: number, band: number, threshold = 8): boolean {
  for (let y = 0; y < height; y++) {
    const inBandY = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      if (!inBandY && x >= band && x < width - band) {
        x = width - band - 1;
        continue;
      }
      if (rgba[(y * width + x) * 4 + 3]! > threshold) return true;
    }
  }
  return false;
}
