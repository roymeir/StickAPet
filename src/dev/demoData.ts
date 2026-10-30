import { Asset } from 'expo-asset';

import type { StyleId } from '@/config/styles';
import { useAppStore } from '@/state/appStore';
import { docStore } from '@/storage/stores';

const DEMO = [
  require('../../assets/demo/sticker-1.webp'),
  require('../../assets/demo/sticker-2.webp'),
  require('../../assets/demo/sticker-3.webp'),
  require('../../assets/demo/sticker-4.webp'),
  require('../../assets/demo/sticker-5.webp'),
  require('../../assets/demo/sticker-6.webp'),
];

const TAGS = [['❤️', '😊'], ['😂'], ['😎'], ['🥰', '❤️'], ['😴'], ['😡']];
const STYLES: StyleId[] = ['cartoon', 'classic', 'comic', 'anime', 'clay', 'cartoon'];

async function loadDemoBytes(mod: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const tmp = `tmp/demo-${asset.hash ?? asset.name}.webp`;
  await docStore.importUri(asset.localUri ?? asset.uri, tmp);
  const bytes = await docStore.readBytes(tmp);
  await docStore.remove(tmp);
  if (!bytes) throw new Error('demo asset missing');
  return bytes;
}

/** Mock packs for the Home screen (web preview `?demo=1`, or Settings → Diagnostics in dev). */
export async function loadDemoPacks(names: { full: string; partial: string }) {
  const store = useAppStore.getState();
  const full = await store.createPack(names.full);
  for (let i = 0; i < 4; i++) {
    await useAppStore.getState().addSticker(full.id, { webp: await loadDemoBytes(DEMO[i]), emojis: TAGS[i]!, styleId: STYLES[i]! });
  }
  const partial = await useAppStore.getState().createPack(names.partial);
  for (let i = 4; i < 6; i++) {
    await useAppStore.getState().addSticker(partial.id, { webp: await loadDemoBytes(DEMO[i]), emojis: TAGS[i]!, styleId: STYLES[i]! });
  }
}
