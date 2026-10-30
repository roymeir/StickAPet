import { create } from 'zustand';

import type { AppData, Pack, Settings, Sticker } from '@/domain/types';
import { renderTrayPng } from '@/imaging/exportWebp';
import { decodeImage } from '@/imaging/skia';
import { docStore } from '@/storage/stores';

import { emptyAppData } from './defaults';
import * as repo from './packRepo';

const deps: repo.RepoDeps = {
  store: docStore,
  renderTray: async (webp) => renderTrayPng(decodeImage(webp)),
};

interface AppState {
  hydrated: boolean;
  data: AppData;
  hydrate: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  createPack: (name: string) => Promise<Pack>;
  addSticker: (packId: string, input: repo.NewStickerInput) => Promise<Sticker>;
  deleteSticker: (packId: string, stickerId: string) => Promise<void>;
  moveSticker: (packId: string, stickerId: string, toIndex: number) => Promise<void>;
  setStickerEmojis: (packId: string, stickerId: string, emojis: string[]) => Promise<void>;
  renamePack: (packId: string, name: string) => Promise<void>;
  deletePack: (packId: string) => Promise<void>;
  /** Replaces everything (used by the web preview's demo data). */
  replaceData: (data: AppData) => Promise<void>;
}

// Serialize mutations so two quick taps can't interleave file writes.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const useAppStore = create<AppState>((set, get) => {
  const commit = async (data: AppData) => {
    set({ data });
    await repo.saveAppData(docStore, data);
  };

  return {
    hydrated: false,
    data: emptyAppData(),

    hydrate: () =>
      serial(async () => {
        if (get().hydrated) return;
        const data = await repo.loadAppData(docStore);
        set({ data, hydrated: true });
      }),

    updateSettings: (patch) =>
      serial(async () => {
        const { data } = get();
        await commit({ ...data, settings: { ...data.settings, ...patch } });
      }),

    createPack: (name) =>
      serial(async () => {
        const { data } = get();
        const result = repo.createPack(data, name, data.settings.publisher);
        await commit(result.data);
        return result.pack;
      }),

    addSticker: (packId, input) =>
      serial(async () => {
        const result = await repo.addSticker(deps, get().data, packId, input);
        await commit(result.data);
        return result.sticker;
      }),

    deleteSticker: (packId, stickerId) =>
      serial(async () => commit(await repo.deleteSticker(deps, get().data, packId, stickerId))),

    moveSticker: (packId, stickerId, toIndex) =>
      serial(async () => commit(await repo.moveSticker(deps, get().data, packId, stickerId, toIndex))),

    setStickerEmojis: (packId, stickerId, emojis) =>
      serial(async () => commit(await repo.setStickerEmojis(deps, get().data, packId, stickerId, emojis))),

    renamePack: (packId, name) => serial(async () => commit(repo.renamePack(get().data, packId, name))),

    deletePack: (packId) => serial(async () => commit(await repo.deletePack(docStore, get().data, packId))),

    replaceData: (data) => serial(async () => commit(data)),
  };
});

export function usePack(packId: string | undefined): Pack | undefined {
  return useAppStore((s) => s.data.packs.find((p) => p.id === packId));
}

export const stickerUri = (packId: string, file: string) => docStore.uri(`packs/${packId}/${file}`);
