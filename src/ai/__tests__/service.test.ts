import { getStyle } from '@/config/styles';
import { createMemoryStore } from '@/storage/memoryStore';

import { clearMemoryCache, forgetRun, generationKey, runStyle } from '../service';
import type { StyleProvider } from '../types';

const settings = { model: 'gpt-image-2.5-sunburst', quality: 'medium' as const, variants: 2 as const };
const photo = { uri: 'file:///pet.jpg', mimeType: 'image/jpeg' as const, name: 'pet.jpg' };

function fakeProvider() {
  const generate = jest.fn(async () => ({
    images: [
      { base64: 'AAEC', mimeType: 'image/png' },
      { base64: 'AwQF', mimeType: 'image/png' },
    ],
    usage: { input_tokens: 1000, output_tokens: 2000, input_tokens_details: { image_tokens: 900, text_tokens: 100 } },
    model: settings.model,
  }));
  const provider: StyleProvider = { id: 'fake', generate, verify: async () => {} };
  return { provider, generate };
}

describe('style generation cache', () => {
  beforeEach(() => clearMemoryCache());

  it('does not call the provider again for the same photo + style + settings', async () => {
    const cache = createMemoryStore();
    const { provider, generate } = fakeProvider();
    const args = { photo, photoKey: 'ph1', style: getStyle('anime'), settings, provider, cache };

    const first = await runStyle(args);
    expect(first.cached).toBe(false);
    expect(first.variants).toHaveLength(2);
    expect(first.costUsd).toBeCloseTo((100 * 5 + 900 * 8 + 2000 * 30) / 1e6, 6);
    expect(await cache.readBytes(`ai/${first.key}/1.png`)).toEqual(Uint8Array.of(3, 4, 5));

    const second = await runStyle(args);
    expect(second.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);

    // Survives an app restart (memory cleared, disk cache kept).
    clearMemoryCache();
    const third = await runStyle(args);
    expect(third.cached).toBe(true);
    expect(third.costUsd).toBeCloseTo(first.costUsd!, 6);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('uses a different key for a different style, photo, model or quality', () => {
    const base = generationKey('ph1', getStyle('anime'), settings);
    expect(generationKey('ph2', getStyle('anime'), settings)).not.toBe(base);
    expect(generationKey('ph1', getStyle('chibi'), settings)).not.toBe(base);
    expect(generationKey('ph1', getStyle('anime'), { ...settings, model: 'gpt-image-2' })).not.toBe(base);
    expect(generationKey('ph1', getStyle('anime'), { ...settings, quality: 'high' })).not.toBe(base);
  });

  it('"Generate again" forgets the cached run', async () => {
    const cache = createMemoryStore();
    const { provider, generate } = fakeProvider();
    const args = { photo, photoKey: 'ph1', style: getStyle('comic'), settings, provider, cache };
    const first = await runStyle(args);
    await forgetRun(first.key, cache);
    await runStyle(args);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('refuses to send the Classic style to AI', async () => {
    const { provider } = fakeProvider();
    await expect(runStyle({ photo, photoKey: 'x', style: getStyle('classic'), settings, provider, cache: createMemoryStore() })).rejects.toThrow('does not use AI');
  });
});
