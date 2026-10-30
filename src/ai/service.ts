import { costFromUsage } from '@/config/ai';
import { buildPrompt, type StickerStyle } from '@/config/styles';
import type { Settings } from '@/domain/types';
import { base64ToBytes } from '@/lib/base64';
import { hashString } from '@/lib/ids';
import type { FileStore } from '@/storage/fileStore';

import { createOpenAIProvider } from './openai';
import { AiError, type PhotoInput, type StyleProvider } from './types';

export interface StyledVariant {
  uri: string;
}

export interface StyleRun {
  key: string;
  variants: StyledVariant[];
  /** USD computed from the response's token usage, if reported. */
  costUsd: number | null;
  /** True when served from cache (no new request, no new charge). */
  cached: boolean;
}

interface CacheMeta {
  count: number;
  costUsd: number | null;
}

const memory = new Map<string, StyleRun>();

export function generationKey(photoKey: string, style: Pick<StickerStyle, 'id' | 'prompt'>, settings: Pick<Settings, 'model' | 'quality' | 'variants'>): string {
  return hashString([photoKey, style.id, settings.model, settings.quality, settings.variants, hashString(buildPrompt(style) ?? '')].join('|'));
}

export interface RunStyleArgs {
  photo: PhotoInput;
  /** Identifies the source photo (same photo → same key → cache hit). */
  photoKey: string;
  style: StickerStyle;
  settings: Pick<Settings, 'model' | 'quality' | 'variants'>;
  provider: StyleProvider;
  cache: FileStore;
  signal?: AbortSignal;
}

/**
 * Restyles the photo, caching results in memory and on disk so going back and forth in the
 * wizard (or re-picking the same photo + style) never pays twice.
 */
export async function runStyle({ photo, photoKey, style, settings, provider, cache, signal }: RunStyleArgs): Promise<StyleRun> {
  const prompt = buildPrompt(style);
  if (!prompt) throw new Error(`Style ${style.id} does not use AI`);
  const key = generationKey(photoKey, style, settings);

  const hit = memory.get(key);
  if (hit) return { ...hit, cached: true };

  const metaText = await cache.readText(`ai/${key}/meta.json`);
  if (metaText) {
    const meta = JSON.parse(metaText) as CacheMeta;
    const variants: StyledVariant[] = [];
    for (let i = 0; i < meta.count; i++) {
      if (await cache.exists(`ai/${key}/${i}.png`)) variants.push({ uri: cache.uri(`ai/${key}/${i}.png`) });
    }
    if (variants.length > 0) {
      const run = { key, variants, costUsd: meta.costUsd, cached: true };
      memory.set(key, run);
      return run;
    }
  }

  const result = await provider.generate(photo, prompt, { variants: settings.variants, signal });
  const variants: StyledVariant[] = [];
  for (const [i, img] of result.images.entries()) {
    const path = `ai/${key}/${i}.png`;
    await cache.writeBytes(path, base64ToBytes(img.base64));
    variants.push({ uri: cache.uri(path) });
  }
  const costUsd = costFromUsage(result.usage);
  await cache.writeText(`ai/${key}/meta.json`, JSON.stringify({ count: variants.length, costUsd } satisfies CacheMeta));
  const run = { key, variants, costUsd, cached: false };
  memory.set(key, run);
  return { ...run };
}

export function makeProvider(apiKey: string | null, settings: Pick<Settings, 'model' | 'quality'>, toFilePart: Parameters<typeof createOpenAIProvider>[0]['toFilePart']): StyleProvider {
  if (!apiKey?.trim()) throw new AiError('missing_key', 'No API key');
  return createOpenAIProvider({ apiKey, model: settings.model, quality: settings.quality, toFilePart });
}

/** Drops a cached generation so "Generate again" makes a fresh request. */
export async function forgetRun(key: string, cache: FileStore): Promise<void> {
  memory.delete(key);
  await cache.remove(`ai/${key}`);
}

/** For tests. */
export function clearMemoryCache() {
  memory.clear();
}
