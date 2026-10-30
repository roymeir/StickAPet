/**
 * WhatsApp sticker rules, mirrored from the official sample apps
 * (github.com/WhatsApp/stickers: Android StickerPackValidator.java, iOS Limits.swift).
 */
export const WA = {
  STICKER_SIZE: 512,
  /** Recommended transparent margin around the art. */
  STICKER_MARGIN: 16,
  STATIC_STICKER_MAX_BYTES: 100 * 1024,
  TRAY_SIZE: 96,
  TRAY_MAX_BYTES: 50 * 1024,
  TRAY_DIMENSION_MIN: 24,
  TRAY_DIMENSION_MAX: 512,
  MIN_STICKERS: 3,
  MAX_STICKERS: 30,
  MAX_CHARS: 128,
  EMOJI_MIN: 1,
  EMOJI_MAX: 3,
  STATIC_A11Y_MAX_CHARS: 125,
  /** Android validator: `[\w-.,'\s]+` and no "..". */
  IDENTIFIER_PATTERN: /^[A-Za-z0-9_\-.,'\s]+$/,
  CONSUMER_PACKAGE: 'com.whatsapp',
  BUSINESS_PACKAGE: 'com.whatsapp.w4b',
  PASTEBOARD_TYPE: 'net.whatsapp.third-party.sticker-pack',
  IOS_URL: 'whatsapp://stickerPack',
} as const;
