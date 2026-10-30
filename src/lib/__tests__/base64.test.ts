import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64', () => {
  it('round-trips arbitrary bytes and matches Node', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255, 1000, 70001]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 7919) % 256);
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe(Buffer.from(bytes).toString('base64'));
      expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
    }
  });
});
