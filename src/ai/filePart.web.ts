import type { FilePart } from './openai';
import type { PhotoInput } from './types';

/** Browsers need a real Blob in FormData. */
export async function toFilePart(photo: PhotoInput): Promise<FilePart> {
  const res = await fetch(photo.uri);
  return new Blob([await res.arrayBuffer()], { type: photo.mimeType });
}
