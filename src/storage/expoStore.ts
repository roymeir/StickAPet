import { Directory, File, Paths } from 'expo-file-system';

import { base64ToBytes } from '@/lib/base64';

import type { FileStore } from './fileStore';

/**
 * FileStore backed by expo-file-system (iOS/Android). `base` is the app's document
 * directory for durable data or the cache directory for regenerable data.
 *
 * Note for the Android ContentProvider: `Paths.document` maps to `Context.getFilesDir()`,
 * which is where modules/whatsapp-stickers reads `stickerpaw/whatsapp/contents.json`.
 */
export function createExpoStore(base: Directory, rootFolder: string): FileStore {
  const root = new Directory(base, rootFolder);

  const file = (path: string) => new File(root, path);

  const ensureParent = (f: File) => {
    const parent = f.parentDirectory;
    if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  };

  return {
    async readText(path) {
      const f = file(path);
      return f.exists ? f.text() : null;
    },
    async writeText(path, text) {
      const f = file(path);
      ensureParent(f);
      // Write to a temp file and move it into place so a crash never leaves half a JSON file.
      const tmp = file(`${path}.tmp`);
      if (tmp.exists) tmp.delete();
      tmp.create({ overwrite: true });
      tmp.write(text);
      if (f.exists) f.delete();
      tmp.move(f);
    },
    async readBytes(path) {
      const f = file(path);
      return f.exists ? f.bytes() : null;
    },
    async writeBytes(path, bytes) {
      const f = file(path);
      ensureParent(f);
      if (!f.exists) f.create({ overwrite: true });
      f.write(bytes);
    },
    async readBase64(path) {
      const f = file(path);
      return f.exists ? f.base64() : null;
    },
    async importUri(uri, path) {
      const f = file(path);
      ensureParent(f);
      if (uri.startsWith('data:')) {
        if (!f.exists) f.create({ overwrite: true });
        f.write(base64ToBytes(uri.slice(uri.indexOf(',') + 1)));
        return;
      }
      if (f.exists) f.delete();
      new File(uri).copy(f);
    },
    async exists(path) {
      return file(path).exists || new Directory(root, path).exists;
    },
    async size(path) {
      const f = file(path);
      return f.exists ? f.size : 0;
    },
    async remove(path) {
      const f = file(path);
      if (f.exists) {
        f.delete();
        return;
      }
      const d = new Directory(root, path);
      if (d.exists) d.delete();
    },
    uri(path) {
      return file(path).uri;
    },
  };
}

export const expoPaths = { document: () => Paths.document, cache: () => Paths.cache };
