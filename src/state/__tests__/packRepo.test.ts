import type { AppData } from '@/domain/types';
import { createMemoryStore } from '@/storage/memoryStore';
import { WHATSAPP_MANIFEST_PATH } from '@/whatsapp/contents';
import { WA } from '@/whatsapp/limits';

import { emptyAppData } from '../defaults';
import * as repo from '../packRepo';

function setup() {
  const store = createMemoryStore();
  const trayCalls: number[] = [];
  const deps: repo.RepoDeps = {
    store,
    // Fake tray: remember which sticker it was made from (first byte).
    renderTray: async (webp) => {
      trayCalls.push(webp[0]!);
      return Uint8Array.of(webp[0]!);
    },
  };
  return { store, deps, trayCalls };
}

const sticker = (tag: number) => ({ webp: Uint8Array.of(tag, 1, 2, 3), emojis: ['❤️', '😂', '😎', '🔥'], styleId: 'classic' as const });

async function packWith(deps: repo.RepoDeps, n: number): Promise<{ data: AppData; packId: string; ids: string[] }> {
  const created = repo.createPack(emptyAppData(), '  Luna  ', 'Stickerpaw');
  let data = created.data;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await repo.addSticker(deps, data, created.pack.id, sticker(10 + i));
    data = r.data;
    ids.push(r.sticker.id);
  }
  return { data, packId: created.pack.id, ids };
}

describe('pack repository', () => {
  it('creates packs with a WhatsApp-safe identifier and trimmed name', () => {
    const { data, pack } = repo.createPack(emptyAppData(), '  Luna  ', 'Me');
    expect(data.packs).toHaveLength(1);
    expect(pack.name).toBe('Luna');
    expect(pack.id).toMatch(WA.IDENTIFIER_PATTERN);
    expect(pack.imageDataVersion).toBe(1);
  });

  it('writes sticker files, makes the tray from the first sticker and caps emojis at 3', async () => {
    const { store, deps, trayCalls } = setup();
    const { data, packId, ids } = await packWith(deps, 3);
    const pack = repo.findPack(data, packId);
    expect(pack.stickers.map((s) => s.id)).toEqual(ids);
    expect(pack.stickers[0]!.emojis).toEqual(['❤️', '😂', '😎']);
    expect(await store.readBytes(`packs/${packId}/${pack.stickers[1]!.file}`)).toEqual(Uint8Array.of(11, 1, 2, 3));
    expect(pack.trayFile).toBe('tray.png');
    expect(trayCalls).toEqual([10]); // only rendered when the first sticker changed
  });

  it('bumps image_data_version on every sticker change', async () => {
    const { deps } = setup();
    const { data, packId, ids } = await packWith(deps, 3);
    const v0 = repo.findPack(data, packId).imageDataVersion;
    const d1 = await repo.setStickerEmojis(deps, data, packId, ids[1]!, ['🐶']);
    const v1 = repo.findPack(d1, packId).imageDataVersion;
    const d2 = await repo.moveSticker(deps, d1, packId, ids[2]!, 1);
    const v2 = repo.findPack(d2, packId).imageDataVersion;
    const d3 = await repo.deleteSticker(deps, d2, packId, ids[1]!);
    const v3 = repo.findPack(d3, packId).imageDataVersion;
    expect(v1).toBeGreaterThan(v0);
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('regenerates the tray when the first sticker moves or is deleted', async () => {
    const { deps, store, trayCalls } = setup();
    const { data, packId, ids } = await packWith(deps, 3);
    const moved = await repo.moveSticker(deps, data, packId, ids[2]!, 0);
    expect(repo.findPack(moved, packId).stickers[0]!.id).toBe(ids[2]);
    expect(trayCalls.at(-1)).toBe(12);
    const deleted = await repo.deleteSticker(deps, moved, packId, ids[2]!);
    expect(trayCalls.at(-1)).toBe(10);
    expect(await store.exists(`packs/${packId}/${ids[2]}.webp`)).toBe(false);
    expect(repo.findPack(deleted, packId).stickers).toHaveLength(2);
  });

  it('refuses a 31st sticker', async () => {
    const { deps } = setup();
    const { data, packId } = await packWith(deps, WA.MAX_STICKERS);
    await expect(repo.addSticker(deps, data, packId, sticker(1))).rejects.toThrow('PACK_FULL');
  });

  it('persists AppData and the WhatsApp contents.json manifest', async () => {
    const { deps, store } = setup();
    const { data, packId } = await packWith(deps, 3);
    await repo.saveAppData(store, data);
    expect(await repo.loadAppData(store)).toEqual(data);
    const manifest = JSON.parse((await store.readText(WHATSAPP_MANIFEST_PATH))!);
    expect(manifest.sticker_packs).toHaveLength(1);
    const p = manifest.sticker_packs[0];
    expect(p).toMatchObject({ identifier: packId, name: 'Luna', publisher: 'Stickerpaw', tray_image_file: 'tray.png', animated_sticker_pack: false });
    expect(typeof p.image_data_version).toBe('string');
    expect(p.stickers[0]).toEqual({ image_file: expect.stringMatching(/\.webp$/), emojis: ['❤️', '😂', '😎'], accessibility_text: 'A pet sticker' });
  });

  it('survives a corrupt db.json', async () => {
    const { store } = setup();
    await store.writeText(repo.DB_PATH, '{not json');
    const data = await repo.loadAppData(store);
    expect(data.packs).toEqual([]);
    expect(data.settings.language).toBe('he');
  });

  it('renames and deletes packs (and their files)', async () => {
    const { deps, store } = setup();
    const { data, packId } = await packWith(deps, 1);
    const renamed = repo.renamePack(data, packId, '  Max  ');
    expect(repo.findPack(renamed, packId).name).toBe('Max');
    expect(repo.renamePack(renamed, packId, '   ')).toBe(renamed);
    const gone = await repo.deletePack(store, renamed, packId);
    expect(gone.packs).toEqual([]);
    expect(await store.exists(`packs/${packId}`)).toBe(false);
  });
});
