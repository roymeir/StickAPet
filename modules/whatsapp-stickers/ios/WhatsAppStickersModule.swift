import ExpoModulesCore
import UIKit

/// iOS handoff to WhatsApp, following the official sample's Interoperability.swift:
/// put the pack JSON on the general pasteboard under `net.whatsapp.third-party.sticker-pack`
/// (local-only, expiring after 60 s) and open `whatsapp://stickerPack`.
/// The JSON (tray PNG + sticker WebP as base64) is built in JS — see src/whatsapp/contents.ts.
public class WhatsAppStickersModule: Module {
  private static let pasteboardType = "net.whatsapp.third-party.sticker-pack"
  private static let pasteboardExpirationSeconds: TimeInterval = 60
  private static let stickerPackURL = URL(string: "whatsapp://stickerPack")!
  private static let whatsAppURL = URL(string: "whatsapp://")!

  public func definition() -> ModuleDefinition {
    Name("WhatsAppStickers")

    // Resolves false when WhatsApp isn't installed. canOpenURL needs `whatsapp` in
    // LSApplicationQueriesSchemes (added by app.plugin.js).
    AsyncFunction("sendToWhatsAppAsync") { (json: String, promise: Promise) in
      guard let data = json.data(using: .utf8) else {
        promise.reject(PackEncodingException())
        return
      }
      guard UIApplication.shared.canOpenURL(Self.whatsAppURL) else {
        promise.resolve(false)
        return
      }
      UIPasteboard.general.setItems(
        [[Self.pasteboardType: data]],
        options: [
          .localOnly: true,
          .expirationDate: Date(timeIntervalSinceNow: Self.pasteboardExpirationSeconds),
        ]
      )
      UIApplication.shared.open(Self.stickerPackURL, options: [:]) { opened in
        promise.resolve(opened)
      }
    }
    .runOnQueue(.main)
  }
}

final class PackEncodingException: Exception {
  override var reason: String { "Could not encode the sticker pack JSON" }
}
