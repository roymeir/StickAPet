import type { TokenUsage } from '@/config/ai';

/** A local photo to send to the provider. */
export interface PhotoInput {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  name: string;
}

export interface StyledImage {
  /** Base64-encoded PNG. */
  base64: string;
  mimeType: string;
}

export interface GenerateOptions {
  /** Number of variants to request (1–2). */
  variants: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  images: StyledImage[];
  usage?: TokenUsage;
  model: string;
}

/**
 * Anything that can restyle a pet photo. Swap implementations without touching the UI:
 * `generate(photo, stylePrompt) → images`.
 */
export interface StyleProvider {
  readonly id: string;
  generate(photo: PhotoInput, stylePrompt: string, options: GenerateOptions): Promise<GenerateResult>;
  /** Cheap request that proves the credentials work (used by Settings → Test key). */
  verify(signal?: AbortSignal): Promise<void>;
}

export type AiErrorKind =
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limit'
  | 'quota'
  | 'content_policy'
  | 'org_verification'
  | 'model_unavailable'
  | 'bad_request'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'server'
  | 'bad_response';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly status?: number,
    readonly serverCode?: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
