import type { FilePart } from './openai';
import type { PhotoInput } from './types';

/** React Native's FormData uploads a local file from `{ uri, name, type }`. */
export async function toFilePart(photo: PhotoInput): Promise<FilePart> {
  return { uri: photo.uri, name: photo.name, type: photo.mimeType };
}
