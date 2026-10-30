import { DEFAULT_IMAGE_MODEL } from '@/config/ai';
import type { AppData, Settings } from '@/domain/types';

export const DEFAULT_SETTINGS: Settings = {
  language: 'he',
  theme: 'system',
  outlinePct: 0.04,
  shadow: true,
  variants: 2,
  quality: 'medium',
  model: DEFAULT_IMAGE_MODEL,
  publisher: 'Stickerpaw',
  directionReloadFor: null,
};

export const OUTLINE_CHOICES = [0, 0.02, 0.03, 0.04, 0.05, 0.06] as const;

export function emptyAppData(): AppData {
  return { schemaVersion: 1, packs: [], settings: { ...DEFAULT_SETTINGS } };
}

/** Accepts anything parsed from disk and returns a well-formed AppData. */
export function normalizeAppData(raw: unknown): AppData {
  const base = emptyAppData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  return {
    schemaVersion: 1,
    packs: Array.isArray(r.packs) ? r.packs.filter((p) => p && typeof p.id === 'string') : [],
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}
