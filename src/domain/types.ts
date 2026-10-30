import type { StyleId } from '@/config/styles';

export type Language = 'he' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';
export type ImageQuality = 'low' | 'medium' | 'high';

export interface Sticker {
  /** Stable id; also the file name stem (`<id>.webp`). */
  id: string;
  /** WebP file name inside the pack folder. */
  file: string;
  /** 1–3 emoji tags used by WhatsApp search. */
  emojis: string[];
  styleId: StyleId;
  caption?: string;
  cornerEmoji?: string;
  /** Size of the WebP on disk, in bytes. */
  bytes: number;
  createdAt: number;
}

export interface Pack {
  /** WhatsApp `identifier`. Only [a-zA-Z0-9_-. ] are allowed, so we generate it. */
  id: string;
  name: string;
  publisher: string;
  stickers: Sticker[];
  /** Tray icon file name inside the pack folder, generated from the first sticker. */
  trayFile: string | null;
  /** WhatsApp `image_data_version`. Bumped on every change to stickers or the tray. */
  imageDataVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  language: Language;
  theme: ThemeMode;
  /** Default white outline thickness as a fraction of the sticker size (0.04 = 4%). */
  outlinePct: number;
  shadow: boolean;
  /** How many AI variants to request per generation (1 or 2). */
  variants: 1 | 2;
  quality: ImageQuality;
  /** OpenAI image model id; kept in settings so it can be changed without a release. */
  model: string;
  /** Default publisher name for new packs. */
  publisher: string;
  /** Internal: language whose layout direction we already reloaded for (prevents reload loops). */
  directionReloadFor?: Language | null;
}

export interface AppData {
  schemaVersion: 1;
  packs: Pack[];
  settings: Settings;
}
