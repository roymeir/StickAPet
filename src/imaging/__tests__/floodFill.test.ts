import { floodFillBackground } from '../floodFill';

describe('flood-fill background removal (web/test fallback)', () => {
  it('removes a white background connected to the border but keeps the subject and its white parts', () => {
    const w = 20;
    const h = 20;
    const px = new Uint8Array(w * h * 4).fill(255); // white, opaque
    // Orange square subject with a white "muzzle" inside it.
    for (let y = 5; y < 15; y++)
      for (let x = 5; x < 15; x++) {
        const i = (y * w + x) * 4;
        px[i] = 240;
        px[i + 1] = 140;
        px[i + 2] = 40;
      }
    for (let y = 9; y < 11; y++) for (let x = 9; x < 11; x++) px.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 3);
    const out = floodFillBackground(px, w, h);
    const a = (x: number, y: number) => out[(y * w + x) * 4 + 3];
    expect(a(0, 0)).toBe(0);
    expect(a(2, 10)).toBe(0);
    expect(a(10, 10)).toBe(255); // enclosed white stays
    expect(a(7, 7)).toBe(255);
  });
});
