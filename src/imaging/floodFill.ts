/**
 * Removes a plain, light background by flood-filling from the image border.
 *
 * Only used where the native segmentation module is unavailable (web preview, unit tests). It
 * works well on AI renders, which are asked for a flat white background, and poorly on photos.
 * Returns a new RGBA buffer with background alpha set to 0 and a 1px soft edge.
 */
export function floodFillBackground(rgba: Uint8Array, width: number, height: number, tolerance = 28): Uint8Array {
  const out = new Uint8Array(rgba);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  // Reference colour: brightest border pixel run is usually the background; use the corners' mean.
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let r0 = 0;
  let g0 = 0;
  let b0 = 0;
  for (const c of corners) {
    r0 += rgba[c * 4]!;
    g0 += rgba[c * 4 + 1]!;
    b0 += rgba[c * 4 + 2]!;
  }
  r0 /= 4;
  g0 /= 4;
  b0 /= 4;
  const tol2 = tolerance * tolerance * 3;
  const isBg = (i: number) => {
    const dr = rgba[i * 4]! - r0;
    const dg = rgba[i * 4 + 1]! - g0;
    const db = rgba[i * 4 + 2]! - b0;
    return rgba[i * 4 + 3]! < 16 || dr * dr + dg * dg + db * db <= tol2;
  };

  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  while (stack.length) {
    const i = stack.pop()!;
    if (visited[i] || !isBg(i)) continue;
    visited[i] = 1;
    out[i * 4 + 3] = 0;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }

  // Soften: foreground pixels touching the background get half alpha.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (visited[i]) continue;
      if (visited[i - 1] || visited[i + 1] || visited[i - width] || visited[i + width]) out[i * 4 + 3] = Math.min(out[i * 4 + 3]!, 140);
    }
  }
  return out;
}
