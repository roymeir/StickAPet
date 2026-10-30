// Config plugin for pet-cutout.
// Android: ask Google Play services to download the ML Kit subject-segmentation model when the
// app is installed (instead of on first use). iOS needs no Info.plist changes.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';

function withPetCutout(config) {
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, META_NAME, 'subject_segment');
    return c;
  });
}

module.exports = withPetCutout;
