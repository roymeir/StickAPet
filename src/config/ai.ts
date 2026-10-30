import type { ImageQuality } from '@/domain/types';

/*
 * AI configuration.
 *
 * SECURITY NOTE: this is a personal app — the user pastes their own OpenAI key in Settings and
 * it is kept in the device keychain/keystore (expo-secure-store). It is only ever sent to the
 * provider's API. Before publishing to an app store, move AI calls behind a small server proxy
 * so no API key ships inside (or is typed into) the app. See README → "Before publishing".
 */

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * Default image model for `POST /v1/images/edits`.
 *
 * Checked on 2026-10-30: OpenAI's edit reference lists `gpt-image-2.5-sunburst` as the
 * default/recommended edits model, with `gpt-image-2.5-flare`, `gpt-image-2` and
 * `gpt-image-2-2026-04-21` also accepted; `gpt-image-1` was shut down on 2026-10-23.
 * The model can be changed in Settings without a new build.
 */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';

export const IMAGE_MODEL_PRESETS = [
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
  'gpt-image-2',
] as const;

export const IMAGE_SIZE = '1024x1024';

/** Generation can take a while for high quality; give up after this long. */
export const GENERATION_TIMEOUT_MS = 180_000;

/**
 * Rough price estimate shown in Settings (USD). OpenAI bills GPT Image models by tokens; these
 * figures are per-image list-price estimates for a 1024×1024 edit (output image + one input
 * photo + prompt). Treat as a guide only — after each generation the app shows the cost
 * computed from the `usage` field of the actual response.
 */
export const PRICING = {
  /** USD per 1M tokens. */
  textInputPerM: 5,
  imageInputPerM: 8,
  imageOutputPerM: 30,
  /** Approximate output-image cost per 1024×1024 image. */
  outputPerImage: { low: 0.006, medium: 0.013, high: 0.053 } satisfies Record<ImageQuality, number>,
  /** Approximate cost of the input photo + prompt per request (high-fidelity image input). */
  inputPerRequest: 0.02,
  asOf: '2026-10',
} as const;

export function estimateCostUsd(quality: ImageQuality, variants: number): number {
  return PRICING.inputPerRequest + PRICING.outputPerImage[quality] * variants;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

/** Cost of one request, computed from the `usage` block of the API response. */
export function costFromUsage(usage: TokenUsage | undefined): number | null {
  if (!usage || typeof usage.output_tokens !== 'number') return null;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const textIn = usage.input_tokens_details?.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - imageIn);
  return (
    (textIn * PRICING.textInputPerM + imageIn * PRICING.imageInputPerM + usage.output_tokens * PRICING.imageOutputPerM) /
    1_000_000
  );
}
