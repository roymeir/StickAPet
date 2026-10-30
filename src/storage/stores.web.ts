import type { FileStore } from './fileStore';
import { createMemoryStore } from './memoryStore';

// Web is a development preview only (see DECISIONS.md): data lives in memory.
export const docStore: FileStore = createMemoryStore();
export const cacheStore: FileStore = createMemoryStore();
