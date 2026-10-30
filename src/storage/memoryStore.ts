import { base64ToBytes, bytesToBase64 } from '@/lib/base64';

import { type FileStore, mimeForPath } from './fileStore';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * In-memory FileStore. Used by unit tests and by the web preview, where
 * expo-file-system is not available. Nothing survives a reload.
 */
export function createMemoryStore(
  options: { fetchUri?: (uri: string) => Promise<Uint8Array> } = {},
): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  const urls = new Map<string, string>();

  const dropUrl = (path: string) => {
    const url = urls.get(path);
    if (url && url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
    urls.delete(path);
  };

  const put = (path: string, bytes: Uint8Array) => {
    dropUrl(path);
    files.set(path, bytes);
  };

  return {
    files,
    async readText(path) {
      const b = files.get(path);
      return b ? decoder.decode(b) : null;
    },
    async writeText(path, text) {
      put(path, encoder.encode(text));
    },
    async readBytes(path) {
      return files.get(path) ?? null;
    },
    async writeBytes(path, bytes) {
      put(path, bytes);
    },
    async readBase64(path) {
      const b = files.get(path);
      return b ? bytesToBase64(b) : null;
    },
    async importUri(uri, path) {
      if (uri.startsWith('data:')) {
        put(path, base64ToBytes(uri.slice(uri.indexOf(',') + 1)));
        return;
      }
      if (options.fetchUri) {
        put(path, await options.fetchUri(uri));
        return;
      }
      const res = await fetch(uri);
      put(path, new Uint8Array(await res.arrayBuffer()));
    },
    async exists(path) {
      if (files.has(path)) return true;
      const prefix = path.endsWith('/') ? path : `${path}/`;
      for (const key of files.keys()) if (key.startsWith(prefix)) return true;
      return false;
    },
    async size(path) {
      return files.get(path)?.length ?? 0;
    },
    async remove(path) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      for (const key of [...files.keys()]) {
        if (key === path || key.startsWith(prefix)) {
          dropUrl(key);
          files.delete(key);
        }
      }
    },
    uri(path) {
      const cached = urls.get(path);
      if (cached) return cached;
      const bytes = files.get(path);
      if (!bytes) return '';
      let url = `data:${mimeForPath(path)};base64,${bytesToBase64(bytes)}`;
      try {
        // Browsers: blob URLs are much cheaper than data URIs for images.
        if (typeof document !== 'undefined') url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeForPath(path) }));
      } catch {
        // Keep the data URI.
      }
      urls.set(path, url);
      return url;
    },
  };
}
