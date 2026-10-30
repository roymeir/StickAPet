import { buildPrompt, getStyle, SHARED_RULES } from '@/config/styles';

import { createOpenAIProvider, type OpenAIProviderOptions } from '../openai';
import { AiError, type PhotoInput } from '../types';

const PHOTO: PhotoInput = { uri: 'file:///tmp/pet.jpg', mimeType: 'image/jpeg', name: 'pet.jpg' };
const PNG_B64 = 'iVBORw0KGgo=';

type Call = { url: string; init: RequestInit };

/** Mocked HTTP layer: records requests and replies with queued responses. */
function mockFetch(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetchFn: fn as unknown as typeof fetch, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const errorBody = (status: number, message: string, code: string | null = null, type = 'invalid_request_error', param: string | null = null) =>
  json(status, { error: { message, type, code, param } });

function provider(fetchFn: typeof fetch, extra: Partial<OpenAIProviderOptions> = {}) {
  return createOpenAIProvider({
    apiKey: 'sk-test-123',
    model: 'gpt-image-2.5-sunburst',
    quality: 'medium',
    fetchFn,
    toFilePart: async (p) => new Blob([new Uint8Array([1, 2, 3])], { type: p.mimeType }),
    ...extra,
  });
}

const prompt = buildPrompt(getStyle('anime'))!;

describe('OpenAI image edits provider (mocked HTTP)', () => {
  it('sends a multipart edit request with the configured model, prompt and variants', async () => {
    const { fetchFn, calls } = mockFetch(json(200, { data: [{ b64_json: PNG_B64 }, { b64_json: PNG_B64 }], usage: { input_tokens: 1200, output_tokens: 4000, input_tokens_details: { image_tokens: 1000, text_tokens: 200 } } }));
    const result = await provider(fetchFn).generate(PHOTO, prompt, { variants: 2 });

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-123');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('gpt-image-2.5-sunburst');
    expect(form.get('n')).toBe('2');
    expect(form.get('size')).toBe('1024x1024');
    expect(form.get('quality')).toBe('medium');
    expect(form.get('image')).toBeInstanceOf(Blob);
    expect(String(form.get('prompt'))).toContain(SHARED_RULES);
    expect(String(form.get('prompt'))).toContain('plain flat pure white');

    expect(result.images).toEqual([
      { base64: PNG_B64, mimeType: 'image/png' },
      { base64: PNG_B64, mimeType: 'image/png' },
    ]);
    expect(result.usage?.output_tokens).toBe(4000);
    expect(result.model).toBe('gpt-image-2.5-sunburst');
  });

  it.each([
    [errorBody(401, 'Incorrect API key provided: sk-***', 'invalid_api_key'), 'invalid_key'],
    [errorBody(429, 'Rate limit reached for requests', 'rate_limit_exceeded', 'requests'), 'rate_limit'],
    [errorBody(429, 'You exceeded your current quota, please check your plan and billing details.', 'insufficient_quota', 'insufficient_quota'), 'quota'],
    [errorBody(400, 'Your request was rejected as a result of our safety system.', 'moderation_blocked'), 'content_policy'],
    [errorBody(400, 'Request was rejected by the safety system', 'content_policy_violation'), 'content_policy'],
    [errorBody(403, 'Your organization must be verified to use the model `gpt-image-2.5-sunburst`.', null), 'org_verification'],
    [errorBody(404, 'The model `gpt-image-9` does not exist or you do not have access to it.', 'model_not_found'), 'model_unavailable'],
    [errorBody(400, 'Invalid image file or mode.', 'invalid_image'), 'bad_request'],
    [errorBody(500, 'The server had an error while processing your request.', null, 'server_error'), 'server'],
    [new Response('<html>Bad gateway</html>', { status: 502 }), 'server'],
  ])('maps %#: HTTP errors to friendly kinds', async (response, kind) => {
    const { fetchFn } = mockFetch(response as Response);
    const err = await provider(fetchFn)
      .generate(PHOTO, prompt, { variants: 1 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe(kind);
  });

  it('reports a missing key without calling the network', async () => {
    const { fetchFn, calls } = mockFetch();
    await expect(provider(fetchFn, { apiKey: '  ' }).generate(PHOTO, prompt, { variants: 1 })).rejects.toMatchObject({ kind: 'missing_key' });
    expect(calls).toHaveLength(0);
  });

  it('maps network failures', async () => {
    const { fetchFn } = mockFetch(new TypeError('Network request failed'));
    await expect(provider(fetchFn).generate(PHOTO, prompt, { variants: 1 })).rejects.toMatchObject({ kind: 'network' });
  });

  it('supports cancellation through an AbortSignal', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const controller = new AbortController();
    const pending = provider(fetchFn).generate(PHOTO, prompt, { variants: 1, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('times out slow requests', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    await expect(provider(fetchFn, { timeoutMs: 20 }).generate(PHOTO, prompt, { variants: 1 })).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('retries once without a parameter the model rejects', async () => {
    const { fetchFn, calls } = mockFetch(errorBody(400, "Unknown parameter: 'quality'.", 'unknown_parameter', 'invalid_request_error', 'quality'), json(200, { data: [{ b64_json: PNG_B64 }] }));
    const result = await provider(fetchFn).generate(PHOTO, prompt, { variants: 1 });
    expect(result.images).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect((calls[1]!.init.body as FormData).get('quality')).toBeNull();
  });

  it('rejects a 200 response without images', async () => {
    const { fetchFn } = mockFetch(json(200, { data: [{ url: 'https://example.com/x.png' }] }));
    await expect(provider(fetchFn).generate(PHOTO, prompt, { variants: 1 })).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('verify() checks the key against the configured model', async () => {
    const { fetchFn, calls } = mockFetch(json(200, { id: 'gpt-image-2.5-sunburst', object: 'model' }), errorBody(401, 'Incorrect API key provided', 'invalid_api_key'));
    await provider(fetchFn).verify();
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/models/gpt-image-2.5-sunburst');
    expect(calls[0]!.init.method).toBe('GET');
    await expect(provider(fetchFn).verify()).rejects.toMatchObject({ kind: 'invalid_key' });
  });
});
