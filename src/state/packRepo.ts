/**
 * Pack persistence. Pure functions over (FileStore, AppData) so they can be unit-tested
 * with an in-memory store. Every mutation returns a new AppData; callers persist it.
 *
 * Layout inside the doc store:
 *   db.json                         – AppData (packs + settings)
 *   packs/<packId>/<stickerId>.webp – 512×512 stickers
 *   packs/<packId>/tray.png         – 96×96 tray icon (from the first sticker)
 *   whatsapp/contents.json          – manifest read by the Android ContentProvider
 */
import type { StyleId } from '@/config/styles';
import type { AppData, Pack, Sticker } from '@/domain/types';
import { newId } from '@/lib/ids';
import type { FileStore } from '@/storage/fileStore';
import { buildContentsJson, packDir, packFilePath, WHATSAPP_MANIFEST_PATH } from '@/whatsapp/contents';
import { WA } from '@/whatsapp/limits';

import { normalizeAppData } from './defaults';

export const DB_PATH = 'db.json';
export const TRAY_FILE = 'tray.png';

export interface RepoDeps {
  store: FileStore;
  /** Renders the 96×96 PNG tray icon from a sticker's WebP bytes. */
  renderTray: (stickerWebp: Uint8Array) => Promise<Uint8Array>;
}

export async function loadAppData(store: FileStore): Promise<AppData> {
  const text = await store.readText(DB_PATH);
  if (!text) return normalizeAppData(null);
  try {
    return normalizeAppData(JSON.parse(text));
  } catch {
    // Keep the broken file around for debugging rather than silently losing it.
    await store.writeText(`${DB_PATH}.corrupt-${Date.now()}`, text);
    return normalizeAppData(null);
  }
}

export async function saveAppData(store: FileStore, data: AppData): Promise<void> {
  await store.writeText(DB_PATH, JSON.stringify(data));
  await store.writeText(WHATSAPP_MANIFEST_PATH, JSON.stringify(buildContentsJson(data.packs), null, 2));
}

function replacePack(data: AppData, pack: Pack): AppData {
  return { ...data, packs: data.packs.map((p) => (p.id === pack.id ? pack : p)) };
}

export function findPack(data: AppData, packId: string): Pack {
  const pack = data.packs.find((p) => p.id === packId);
  if (!pack) throw new Error(`Pack not found: ${packId}`);
  return pack;
}

export function createPack(data: AppData, name: string, publisher: string, now = Date.now()): { data: AppData; pack: Pack } {
  const pack: Pack = {
    id: newId('p'),
    name: name.trim().slice(0, WA.MAX_CHARS),
    publisher: publisher.trim().slice(0, WA.MAX_CHARS),
    stickers: [],
    trayFile: null,
    imageDataVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, packs: [pack, ...data.packs] }, pack };
}

/** Regenerates the tray icon from the first sticker and bumps image_data_version. */
async function touchPack(deps: RepoDeps, pack: Pack, trayChanged: boolean): Promise<Pack> {
  let trayFile = pack.trayFile;
  if (trayChanged) {
    const first = pack.stickers[0];
    if (first) {
      const webp = await deps.store.readBytes(packFilePath(pack.id, first.file));
      if (webp) {
        await deps.store.writeBytes(packFilePath(pack.id, TRAY_FILE), await deps.renderTray(webp));
        trayFile = TRAY_FILE;
      }
    } else {
      await deps.store.remove(packFilePath(pack.id, TRAY_FILE));
      trayFile = null;
    }
  }
  return { ...pack, trayFile, imageDataVersion: pack.imageDataVersion + 1, updatedAt: Date.now() };
}

export interface NewStickerInput {
  webp: Uint8Array;
  emojis: string[];
  styleId: StyleId;
  caption?: string;
  cornerEmoji?: string;
}

export async function addSticker(
  deps: RepoDeps,
  data: AppData,
  packId: string,
  input: NewStickerInput,
): Promise<{ data: AppData; sticker: Sticker }> {
  const pack = findPack(data, packId);
  if (pack.stickers.length >= WA.MAX_STICKERS) throw new Error('PACK_FULL');
  const id = newId('s');
  const sticker: Sticker = {
    id,
    file: `${id}.webp`,
    emojis: input.emojis.slice(0, WA.EMOJI_MAX),
    styleId: input.styleId,
    caption: input.caption?.trim() || undefined,
    cornerEmoji: input.cornerEmoji || undefined,
    bytes: input.webp.length,
    createdAt: Date.now(),
  };
  await deps.store.writeBytes(packFilePath(pack.id, sticker.file), input.webp);
  const isFirst = pack.stickers.length === 0;
  const updated = await touchPack(deps, { ...pack, stickers: [...pack.stickers, sticker] }, isFirst || !pack.trayFile);
  return { data: replacePack(data, updated), sticker };
}

export async function deleteSticker(deps: RepoDeps, data: AppData, packId: string, stickerId: string): Promise<AppData> {
  const pack = findPack(data, packId);
  const index = pack.stickers.findIndex((s) => s.id === stickerId);
  if (index < 0) return data;
  const sticker = pack.stickers[index]!;
  await deps.store.remove(packFilePath(pack.id, sticker.file));
  const stickers = pack.stickers.filter((s) => s.id !== stickerId);
  return replacePack(data, await touchPack(deps, { ...pack, stickers }, index === 0));
}

export async function moveSticker(deps: RepoDeps, data: AppData, packId: string, stickerId: string, toIndex: number): Promise<AppData> {
  const pack = findPack(data, packId);
  const from = pack.stickers.findIndex((s) => s.id === stickerId);
  const to = Math.max(0, Math.min(pack.stickers.length - 1, toIndex));
  if (from < 0 || from === to) return data;
  const stickers = [...pack.stickers];
  const [moved] = stickers.splice(from, 1);
  stickers.splice(to, 0, moved!);
  return replacePack(data, await touchPack(deps, { ...pack, stickers }, from === 0 || to === 0));
}

export async function setStickerEmojis(deps: RepoDeps, data: AppData, packId: string, stickerId: string, emojis: string[]): Promise<AppData> {
  const pack = findPack(data, packId);
  const stickers = pack.stickers.map((s) => (s.id === stickerId ? { ...s, emojis: emojis.slice(0, WA.EMOJI_MAX) } : s));
  return replacePack(data, await touchPack(deps, { ...pack, stickers }, false));
}

export function renamePack(data: AppData, packId: string, name: string): AppData {
  const pack = findPack(data, packId);
  const trimmed = name.trim().slice(0, WA.MAX_CHARS);
  if (!trimmed || trimmed === pack.name) return data;
  return replacePack(data, { ...pack, name: trimmed, updatedAt: Date.now() });
}

export async function deletePack(store: FileStore, data: AppData, packId: string): Promise<AppData> {
  await store.remove(packDir(packId));
  return { ...data, packs: data.packs.filter((p) => p.id !== packId) };
}
