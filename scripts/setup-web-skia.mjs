// Copies CanvasKit's wasm into public/ so the web preview can load Skia.
// (Only needed for `npm run web`; the iOS/Android apps use native Skia.)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

try {
  const require = createRequire(import.meta.url);
  const src = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin/full/canvaskit.wasm');
  if (existsSync(src)) {
    mkdirSync('public', { recursive: true });
    copyFileSync(src, join('public', 'canvaskit.wasm'));
  }
} catch (e) {
  console.warn('[setup-web-skia] skipped:', e.message);
}
