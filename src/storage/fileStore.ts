/**
 * Minimal file storage abstraction. The app talks to this interface only, so the
 * native implementation (expo-file-system) can be swapped for an in-memory one in
 * unit tests and in the web preview.
 *
 * Paths are relative, forward-slash separated (e.g. `packs/abc/123.webp`).
 */
export interface FileStore {
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  readBase64(path: string): Promise<string | null>;
  /** Copies an external URI (e.g. a picker or manipulator result) into the store. */
  importUri(uri: string, path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  /** Deletes a file or a directory (recursively). Missing paths are ignored. */
  remove(path: string): Promise<void>;
  /** A URI that <Image>, Skia and native modules can read. */
  uri(path: string): string;
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
