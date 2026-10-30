const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < CHARS.length; i++) LOOKUP[CHARS.charCodeAt(i)] = i;

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  // Build in chunks to keep string concatenation cheap on Hermes.
  const chunk: string[] = [];
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < len ? bytes[i + 1]! : 0;
    const c = i + 2 < len ? bytes[i + 2]! : 0;
    chunk.push(
      CHARS[a >> 2]! +
        CHARS[((a & 3) << 4) | (b >> 4)]! +
        (i + 1 < len ? CHARS[((b & 15) << 2) | (c >> 6)]! : '=') +
        (i + 2 < len ? CHARS[c & 63]! : '='),
    );
    if (chunk.length >= 4096) {
      out += chunk.join('');
      chunk.length = 0;
    }
  }
  return out + chunk.join('');
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!;
    const b = LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = i + 2 < len ? LOOKUP[clean.charCodeAt(i + 2)]! : 0;
    const d = i + 3 < len ? LOOKUP[clean.charCodeAt(i + 3)]! : 0;
    if (o < outLen) out[o++] = (a << 2) | (b >> 4);
    if (o < outLen) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < outLen) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}
