/**
 * OpenAI Images API provider (`POST /v1/images/edits`): sends the pet photo plus the style
 * prompt and gets back base64 PNGs.
 *
 * SECURITY: the key is the user's own, read from the device keychain and sent only to
 * api.openai.com. Before publishing to an app store, route these calls through a small server
 * proxy so no key lives in the app (see README → "Before publishing").
 */
import { GENERATION_TIMEOUT_MS, IMAGE_SIZE, OPENAI_BASE_URL } from '@/config/ai';
import type { ImageQuality } from '@/domain/types';

import { AiError, type GenerateResult, type PhotoInput, type StyleProvider } from './types';

/** What we append to FormData for the image. RN accepts `{ uri, name, type }`; web/Node a Blob. */
export type FilePart = Blob | { uri: string; name: string; type: string };

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  quality: ImageQuality;
  size?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  toFilePart: (photo: PhotoInput) => Promise<FilePart>;
}

interface OpenAIErrorBody {
  error?: { message?: string; type?: string; code?: string | null; param?: string | null };
}

/** Parameters that some models may not accept; dropped and retried once if the API says so. */
const OPTIONAL_PARAMS = ['quality', 'size'] as const;

export function createOpenAIProvider(opts: OpenAIProviderOptions): StyleProvider {
  const baseUrl = opts.baseUrl ?? OPENAI_BASE_URL;
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? GENERATION_TIMEOUT_MS;

  async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    if (!opts.apiKey.trim()) throw new AiError('missing_key', 'No API key');
    if (signal?.aborted) throw new AiError('cancelled', 'Cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      return await fetchFn(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${opts.apiKey.trim()}`, ...(init.headers ?? {}) },
        signal: controller.signal,
      });
    } catch (e) {
      if (signal?.aborted) throw new AiError('cancelled', 'Cancelled');
      if (timedOut) throw new AiError('timeout', 'Request timed out');
      throw new AiError('network', e instanceof Error ? e.message : 'Network error');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function generate(photo: PhotoInput, stylePrompt: string, options: { variants: number; signal?: AbortSignal }): Promise<GenerateResult> {
    const omitted = new Set<string>();
    for (let attempt = 0; attempt < 2; attempt++) {
      const form = new FormData();
      form.append('model', opts.model);
      form.append('prompt', stylePrompt);
      form.append('n', String(Math.max(1, Math.min(4, options.variants))));
      if (!omitted.has('size')) form.append('size', opts.size ?? IMAGE_SIZE);
      if (!omitted.has('quality')) form.append('quality', opts.quality);
      form.append('image', (await opts.toFilePart(photo)) as Blob, photo.name);

      const res = await request('/images/edits', { method: 'POST', body: form }, options.signal);
      if (res.ok) return parseImages(res, opts.model);

      const error = await toAiError(res, opts.model);
      const param = error.serverParam;
      if (attempt === 0 && res.status === 400 && param && (OPTIONAL_PARAMS as readonly string[]).includes(param)) {
        omitted.add(param);
        continue;
      }
      throw error.error;
    }
    throw new AiError('bad_response', 'Unreachable');
  }

  async function verify(signal?: AbortSignal) {
    const res = await request(`/models/${encodeURIComponent(opts.model)}`, { method: 'GET' }, signal);
    if (!res.ok) throw (await toAiError(res, opts.model)).error;
  }

  return { id: 'openai', generate, verify };
}

async function parseImages(res: Response, model: string): Promise<GenerateResult> {
  let body: { data?: { b64_json?: string }[]; usage?: GenerateResult['usage'] };
  try {
    body = await res.json();
  } catch {
    throw new AiError('bad_response', 'Response was not JSON', res.status);
  }
  const images = (body.data ?? []).filter((d) => typeof d.b64_json === 'string' && d.b64_json.length > 0).map((d) => ({ base64: d.b64_json!, mimeType: 'image/png' }));
  if (images.length === 0) throw new AiError('bad_response', 'No images in response', res.status);
  return { images, usage: body.usage, model };
}

/** Maps an OpenAI error response to a friendly, typed error. */
export async function toAiError(res: Response, model: string): Promise<{ error: AiError; serverParam?: string }> {
  let body: OpenAIErrorBody = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (proxy error page etc.)
  }
  const message = body.error?.message ?? `HTTP ${res.status}`;
  const code = body.error?.code ?? body.error?.type ?? undefined;
  const param = body.error?.param ?? undefined;
  const status = res.status;
  const make = (kind: ConstructorParameters<typeof AiError>[0]) => ({ error: new AiError(kind, message, status, code ?? undefined), serverParam: param });

  const text = `${code ?? ''} ${message}`.toLowerCase();
  if (status === 401) return make('invalid_key');
  if (status === 429) return make(/insufficient_quota|billing|quota/.test(text) ? 'quota' : 'rate_limit');
  if (/moderation_blocked|content_policy|safety system|safety_violation|rejected by .*safety/.test(text)) return make('content_policy');
  if (/billing_hard_limit|insufficient_quota/.test(text)) return make('quota');
  if (status === 403 && /verif/.test(text)) return make('org_verification');
  if (status === 404 || /model_not_found|does not exist|do not have access to (the )?model/.test(text)) return make('model_unavailable');
  if (status >= 500) return make('server');
  if (status === 403) return make('bad_request');
  void model;
  return make('bad_request');
}
