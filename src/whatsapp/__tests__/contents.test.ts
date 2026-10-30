import type { Pack } from '@/domain/types';

import { accessibilityText, buildContentsJson, buildIosPasteboardJson } from '../contents';

const pack: Pack = {
  id: 'pluna',
  name: 'Luna',
  publisher: 'Me',
  stickers: [
    { id: 'a', file: 'a.webp', emojis: ['❤️'], styleId: 'classic', bytes: 1, createdAt: 0, caption: 'בוקר טוב' },
    { id: 'b', file: 'b.webp', emojis: ['😂', '😎'], styleId: 'anime', bytes: 1, createdAt: 0 },
  ],
  trayFile: 'tray.png',
  imageDataVersion: 7,
  createdAt: 0,
  updatedAt: 0,
};

describe('WhatsApp payloads', () => {
  it('Android contents.json uses the official sample schema', () => {
    const json = buildContentsJson([pack, { ...pack, id: 'empty', stickers: [], trayFile: null }]);
    expect(json.sticker_packs).toHaveLength(1); // packs without stickers/tray are left out
    expect(Object.keys(json.sticker_packs[0]!).sort()).toEqual(
      [
        'animated_sticker_pack',
        'avoid_cache',
        'identifier',
        'image_data_version',
        'license_agreement_website',
        'name',
        'privacy_policy_website',
        'publisher',
        'publisher_email',
        'publisher_website',
        'stickers',
        'tray_image_file',
      ].sort(),
    );
    expect(json.sticker_packs[0]!.image_data_version).toBe('7');
    expect(json.sticker_packs[0]!.stickers[1]).toEqual({ image_file: 'b.webp', emojis: ['😂', '😎'], accessibility_text: 'A pet sticker' });
  });

  it('iOS pasteboard JSON matches the iOS README structure', () => {
    const json = buildIosPasteboardJson(pack, 'VFJBWQ==', ['QQ==', 'Qg==']);
    expect(json).toEqual({
      identifier: 'pluna',
      name: 'Luna',
      publisher: 'Me',
      tray_image: 'VFJBWQ==',
      stickers: [
        { image_data: 'QQ==', emojis: ['❤️'], accessibility_text: 'A pet sticker with text that reads "בוקר טוב"' },
        { image_data: 'Qg==', emojis: ['😂', '😎'], accessibility_text: 'A pet sticker' },
      ],
    });
  });

  it('keeps accessibility text within 125 characters', () => {
    expect(accessibilityText({ caption: 'x'.repeat(300) }).length).toBeLessThanOrEqual(125);
  });
});
