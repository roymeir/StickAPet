/**
 * One real call to OpenAI, only when OPENAI_API_KEY is set in `.env` (or the environment):
 *
 *   echo "OPENAI_API_KEY=sk-..." > .env && npm run test:openai-live
 *
 * Costs one low-quality image (a few cents). Skipped otherwise.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_IMAGE_MODEL } from '@/config/ai';
import { buildPrompt, getStyle } from '@/config/styles';
import { parsePngSize } from '@/lib/webp';
import { ROOT } from '@/testing/fixtures';

import { createOpenAIProvider } from '../openai';

function readKey(): string | undefined {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return undefined;
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='));
  return line?.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '') || undefined;
}

const key = readKey();
const model = process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
const describeLive = key ? describe : describe.skip;

describeLive(`OpenAI live call (${model})`, () => {
  jest.setTimeout(240_000);

  it('verifies the key and restyles the test photo', async () => {
    const photoBytes = fs.readFileSync(path.join(ROOT, 'assets/test/chelsea-cat.png'));
    const provider = createOpenAIProvider({
      apiKey: key!,
      model,
      quality: 'low',
      // Jest's node environment: use Node's own fetch/FormData/Blob.
      fetchFn: globalThis.fetch,
      toFilePart: async () => new Blob([photoBytes], { type: 'image/png' }),
    });
    await provider.verify();
    const result = await provider.generate({ uri: 'test', mimeType: 'image/png', name: 'cat.png' }, buildPrompt(getStyle('cartoon'))!, { variants: 1 });
    expect(result.images).toHaveLength(1);
    const png = new Uint8Array(Buffer.from(result.images[0]!.base64, 'base64'));
    const size = parsePngSize(png);
    expect(size?.width).toBeGreaterThan(255);
    fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'artifacts/openai-live-cartoon.png'), png);
    console.log('usage', JSON.stringify(result.usage));
  });
});
