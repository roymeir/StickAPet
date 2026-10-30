import sharp from 'sharp';

import type { Pack, Sticker } from '@/domain/types';
import { composeSticker } from '@/imaging/compose';
import { encodeStickerWebp, renderTrayPng } from '@/imaging/exportWebp';
import { makeNoisyCutout } from '@/testing/fixtures';

import { validatePack, type PackFiles } from '../validator';

/** Real files produced by our own pipeline (CanvasKit Skia). */
const sticker = composeSticker(makeNoisyCutout(400, 400, 1), { outlinePct: 0.04, shadow: true });
const WEBP = encodeStickerWebp(sticker.image).bytes;
const TRAY = renderTrayPng(sticker.image);

const makeSticker = (i: number, emojis = ['❤️']): Sticker => ({ id: `s${i}`, file: `s${i}.webp`, emojis, styleId: 'classic', bytes: WEBP.length, createdAt: 0 });

function makePack(n: number, patch: Partial<Pack> = {}): Pack {
  return {
    id: 'pabc123',
    name: 'Luna',
    publisher: 'Stickerpaw',
    stickers: Array.from({ length: n }, (_, i) => makeSticker(i)),
    trayFile: 'tray.png',
    imageDataVersion: 3,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const filesFor = (pack: Pack, override: Partial<PackFiles> = {}): PackFiles => ({
  tray: TRAY,
  stickers: pack.stickers.map(() => WEBP),
  ...override,
});

const keys = (pack: Pack, files = filesFor(pack)) => validatePack(pack, files).map((i) => i.key);

describe('WhatsApp pack validator', () => {
  it('accepts a pack produced by our export pipeline (3 and 30 stickers)', () => {
    expect(validatePack(makePack(3), filesFor(makePack(3)))).toEqual([]);
    expect(validatePack(makePack(30), filesFor(makePack(30)))).toEqual([]);
  });

  it('enforces 3–30 stickers per pack', () => {
    expect(keys(makePack(2))).toEqual(['wa.tooFew']);
    expect(keys(makePack(0))).toEqual(['wa.tooFew']);
    expect(keys(makePack(31))).toEqual(['wa.tooMany']);
  });

  it('requires 1–3 emoji tags per sticker', () => {
    const pack = makePack(3);
    pack.stickers[0] = makeSticker(0, []);
    pack.stickers[1] = makeSticker(1, ['😀', '😂', '❤️', '🎉']);
    const issues = validatePack(pack, filesFor(pack));
    expect(issues).toContainEqual({ key: 'wa.emojiMissing', params: { n: 1 } });
    expect(issues).toContainEqual({ key: 'wa.emojiTooMany', params: { n: 2, max: 3 } });
  });

  it('rejects stickers over 100 KB, wrong size, without alpha, animated, or not WebP', async () => {
    const pack = makePack(5);
    const big = new Uint8Array(101 * 1024);
    big.set(WEBP);
    const wrongSize = new Uint8Array(await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp().toBuffer());
    const opaque = new Uint8Array(await sharp({ create: { width: 512, height: 512, channels: 3, background: '#fff' } }).webp().toBuffer());
    const frameA = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 0.5 } } }).png().toBuffer();
    const frameB = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 200, g: 9, b: 9, alpha: 0.5 } } }).png().toBuffer();
    const animated = new Uint8Array(await sharp([frameA, frameB], { join: { animated: true } }).webp({ delay: [100, 100] }).toBuffer());
    const png = TRAY;
    const files = filesFor(pack, { stickers: [big, wrongSize, opaque, animated, png] });
    const issues = validatePack(pack, files);
    expect(issues).toContainEqual({ key: 'wa.stickerTooBig', params: { n: 1, max: 100 } });
    expect(issues).toContainEqual({ key: 'wa.stickerDimensions', params: { n: 2, width: 256, height: 256 } });
    expect(issues).toContainEqual({ key: 'wa.stickerNoAlpha', params: { n: 3 } });
    expect(issues).toContainEqual({ key: 'wa.stickerAnimated', params: { n: 4 } });
    expect(issues).toContainEqual({ key: 'wa.stickerNotWebp', params: { n: 5 } });
  });

  it('reports missing sticker files', () => {
    const pack = makePack(3);
    expect(validatePack(pack, filesFor(pack, { stickers: [WEBP, null, WEBP] }))).toEqual([{ key: 'wa.fileMissing', params: { n: 2 } }]);
  });

  it('checks the tray icon: present, ≤50 KB, 24–512 px', async () => {
    const pack = makePack(3);
    expect(keys({ ...pack, trayFile: null })).toEqual(['wa.trayMissing']);
    const huge = new Uint8Array(51 * 1024);
    huge.set(TRAY);
    expect(keys(pack, filesFor(pack, { tray: huge }))).toEqual(['wa.trayTooBig']);
    const tiny = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#fff' } }).png().toBuffer());
    expect(validatePack(pack, filesFor(pack, { tray: tiny }))).toEqual([{ key: 'wa.trayDimensions', params: { width: 16, height: 16 } }]);
  });

  it('validates name, publisher and identifier like the official sample', () => {
    expect(keys(makePack(3, { name: '   ' }))).toEqual(['wa.nameEmpty']);
    expect(keys(makePack(3, { name: 'x'.repeat(129) }))).toEqual(['wa.nameTooLong']);
    expect(keys(makePack(3, { publisher: '' }))).toEqual(['wa.publisherEmpty']);
    expect(keys(makePack(3, { publisher: 'p'.repeat(129) }))).toEqual(['wa.publisherTooLong']);
    expect(keys(makePack(3, { id: 'bad/id' }))).toEqual(['wa.identifierInvalid']);
    expect(keys(makePack(3, { id: 'a..b' }))).toEqual(['wa.identifierInvalid']);
    expect(keys(makePack(3, { id: 'x'.repeat(129) }))).toEqual(['wa.identifierInvalid']);
    expect(keys(makePack(3, { id: '' }))).toEqual(['wa.identifierInvalid']);
    // Hebrew is fine in the name, but not in the identifier.
    expect(keys(makePack(3, { name: 'החתולה של רוני' }))).toEqual([]);
    expect(keys(makePack(3, { id: 'חתול' }))).toEqual(['wa.identifierInvalid']);
  });
});
