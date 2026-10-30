import type { SkImage } from '@shopify/react-native-skia';
import { create } from 'zustand';

import type { StyleRun } from '@/ai/service';
import { DEFAULT_STYLE_ID, type StyleId } from '@/config/styles';
import type { Stroke } from '@/imaging/touchup';

export interface SourcePhoto {
  /** Unique per picked photo; part of the AI cache key. */
  key: string;
  uri: string;
  width: number;
  height: number;
}

export interface FinishOptions {
  outlinePct: number;
  shadow: boolean;
  caption: string;
  cornerEmoji: string | null;
  /** WhatsApp search tags (1–3). */
  emojis: string[];
  /** Once the user edits tags we stop auto-suggesting from the caption. */
  emojisTouched: boolean;
}

/** State of the "New sticker" wizard. Lives in memory only. */
interface DraftState {
  /** Pack to save into when the flow was started from a pack screen. */
  targetPackId: string | null;
  source: SourcePhoto | null;
  styleId: StyleId;
  run: StyleRun | null;
  /** The image that was cut out (the photo, or the chosen AI variant) and its cut-out. */
  base: { inputUri: string; cutoutUri: string } | null;
  strokes: Stroke[];
  /** Cut-out with the touch-up strokes applied. */
  edited: SkImage | null;
  finish: FinishOptions;

  start: (opts: { targetPackId?: string | null; outlinePct: number; shadow: boolean }) => void;
  set: (patch: Partial<Omit<DraftState, 'start' | 'set' | 'setFinish'>>) => void;
  setFinish: (patch: Partial<FinishOptions>) => void;
}

const initialFinish = (outlinePct: number, shadow: boolean): FinishOptions => ({
  outlinePct,
  shadow,
  caption: '',
  cornerEmoji: null,
  emojis: ['❤️', '😊'],
  emojisTouched: false,
});

export const useDraft = create<DraftState>((set) => ({
  targetPackId: null,
  source: null,
  styleId: DEFAULT_STYLE_ID,
  run: null,
  base: null,
  strokes: [],
  edited: null,
  finish: initialFinish(0.04, true),

  start: ({ targetPackId = null, outlinePct, shadow }) =>
    set({ targetPackId, source: null, styleId: DEFAULT_STYLE_ID, run: null, base: null, strokes: [], edited: null, finish: initialFinish(outlinePct, shadow) }),
  set: (patch) => set(patch),
  setFinish: (patch) => set((s) => ({ finish: { ...s.finish, ...patch } })),
}));

/** Cut-outs by input URI, so stepping back and forth never re-runs segmentation. */
export const cutoutCache = new Map<string, string>();
