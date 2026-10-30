import { createExpoStore, expoPaths } from './expoStore';
import type { FileStore } from './fileStore';

/** Durable app data: packs, stickers, the WhatsApp manifest. */
export const docStore: FileStore = createExpoStore(expoPaths.document(), 'stickerpaw');
/** Regenerable data: AI results, cut-outs, temporary exports. */
export const cacheStore: FileStore = createExpoStore(expoPaths.cache(), 'stickerpaw');
