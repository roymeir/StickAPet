// Web preview entry: RN Skia binds to CanvasKit when its module is first evaluated, so the
// wasm must be loaded before any app module (which import Skia) is required.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-router/entry');
});
