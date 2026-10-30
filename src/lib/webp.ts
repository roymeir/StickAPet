/**
 * Tiny WebP container parser: enough to verify WhatsApp's rules (dimensions, alpha, animation)
 * on the bytes we actually write, without decoding pixels.
 * Spec: https://developers.google.com/speed/webp/docs/riff_container
 */
export interface WebpInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
  animated: boolean;
  /** 'VP8 ' (lossy), 'VP8L' (lossless) or 'VP8X' (extended). */
  kind: 'VP8 ' | 'VP8L' | 'VP8X';
  byteLength: number;
}

const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const u24 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32 = (b: Uint8Array, o: number) => (u24(b, o) | (b[o + 3]! << 24)) >>> 0;

export function parseWebp(bytes: Uint8Array): WebpInfo | null {
  if (bytes.length < 30) return null;
  if (fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WEBP') return null;

  const first = fourcc(bytes, 12);
  const base = { byteLength: bytes.length };

  if (first === 'VP8 ') {
    // Frame tag (3 bytes) + start code 9d 01 2a, then 14-bit width/height.
    const o = 20;
    if (bytes[o + 3] !== 0x9d || bytes[o + 4] !== 0x01 || bytes[o + 5] !== 0x2a) return null;
    const width = (bytes[o + 6]! | (bytes[o + 7]! << 8)) & 0x3fff;
    const height = (bytes[o + 8]! | (bytes[o + 9]! << 8)) & 0x3fff;
    return { ...base, kind: 'VP8 ', width, height, hasAlpha: false, animated: false };
  }

  if (first === 'VP8L') {
    const o = 20;
    if (bytes[o] !== 0x2f) return null;
    const bits = u32(bytes, o + 1);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    const hasAlpha = ((bits >>> 28) & 1) === 1;
    return { ...base, kind: 'VP8L', width, height, hasAlpha, animated: false };
  }

  if (first === 'VP8X') {
    const flags = bytes[20]!;
    const width = u24(bytes, 24) + 1;
    const height = u24(bytes, 27) + 1;
    const animated = (flags & 0x02) !== 0;
    let hasAlpha = (flags & 0x10) !== 0;
    // Walk chunks: the alpha flag must be backed by an ALPH chunk or a VP8L bitstream with alpha.
    let alphaData = false;
    let off = 12;
    while (off + 8 <= bytes.length) {
      const id = fourcc(bytes, off);
      const size = u32(bytes, off + 4);
      if (id === 'ALPH') alphaData = true;
      if (id === 'VP8L' && ((u32(bytes, off + 9) >>> 28) & 1) === 1) alphaData = true;
      if (id === 'ANMF') alphaData = alphaData || hasAlpha;
      off += 8 + size + (size & 1);
    }
    hasAlpha = hasAlpha && alphaData;
    return { ...base, kind: 'VP8X', width, height, hasAlpha, animated };
  }

  return null;
}

/** Reads width/height from a PNG IHDR chunk. */
export function parsePngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((v, i) => bytes[i] === v)) return null;
  const be32 = (o: number) => ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  return { width: be32(16), height: be32(20) };
}
