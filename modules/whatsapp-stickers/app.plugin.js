// Config plugin for whatsapp-stickers. Keeps `npx expo prebuild --clean` reproducible:
//
// iOS:     LSApplicationQueriesSchemes += whatsapp      (needed for canOpenURL("whatsapp://"))
// Android: <provider> WhatsApp reads packs from, with the read permission WhatsApp holds, and
//          <queries> for com.whatsapp / com.whatsapp.w4b (package visibility, Android 11+).
const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const PROVIDER_CLASS = 'expo.modules.whatsappstickers.StickerContentProvider';
const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

function withWhatsAppIos(config) {
  return withInfoPlist(config, (c) => {
    const schemes = new Set(c.modResults.LSApplicationQueriesSchemes ?? []);
    schemes.add('whatsapp');
    c.modResults.LSApplicationQueriesSchemes = [...schemes];
    return c;
  });
}

function withWhatsAppAndroid(config) {
  return withAndroidManifest(config, (c) => {
    const pkg = AndroidConfig.Package.getPackage(c);
    if (!pkg) throw new Error('whatsapp-stickers: set expo.android.package in app.json');
    const manifest = c.modResults.manifest;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);

    app.provider = (app.provider ?? []).filter((p) => p.$['android:name'] !== PROVIDER_CLASS);
    app.provider.push({
      $: {
        'android:name': PROVIDER_CLASS,
        // Must start with the package name (checked by WhatsApp and by the provider itself).
        'android:authorities': `${pkg}.stickercontentprovider`,
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:readPermission': 'com.whatsapp.sticker.READ',
      },
    });

    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    for (const name of WHATSAPP_PACKAGES) {
      if (!queries.package.some((p) => p.$['android:name'] === name)) {
        queries.package.push({ $: { 'android:name': name } });
      }
    }
    return c;
  });
}

module.exports = function withWhatsAppStickers(config) {
  return withWhatsAppAndroid(withWhatsAppIos(config));
};
