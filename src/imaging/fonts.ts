import { Skia } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';

import type { StickerFonts } from './compose';

let loading: Promise<StickerFonts | null> | null = null;

/**
 * Caption font for Skia: Rubik ExtraBold (Latin + Hebrew, SIL OFL), bundled through
 * @expo-google-fonts/rubik. Returns null if it can't be loaded (captions are then skipped).
 */
export function loadStickerFonts(): Promise<StickerFonts | null> {
  loading ??= (async () => {
    try {
      const asset = Asset.fromModule(require('@expo-google-fonts/rubik/800ExtraBold/Rubik_800ExtraBold.ttf'));
      await asset.downloadAsync();
      const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) return null;
      const provider = Skia.TypefaceFontProvider.Make();
      provider.registerFont(typeface, 'Rubik');
      return { provider, family: 'Rubik' };
    } catch {
      return null;
    }
  })();
  return loading;
}
