package expo.modules.whatsappstickers

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.pm.ProviderInfo
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import org.json.JSONObject
import java.io.File

/**
 * The ContentProvider WhatsApp queries for sticker packs. A Kotlin port of the official sample's
 * StickerContentProvider (github.com/WhatsApp/stickers), with one change: packs come from
 * `files/stickerpaw/whatsapp/contents.json` and `files/stickerpaw/packs/<id>/` (written by the
 * app at runtime) instead of the APK assets. The JSON uses the sample's contents.json schema.
 *
 * URIs (do not change — WhatsApp depends on them):
 *   <authority>/metadata                               all packs
 *   <authority>/metadata/<identifier>                  one pack
 *   <authority>/stickers/<identifier>                  stickers of a pack
 *   <authority>/stickers_asset/<identifier>/<file>     sticker or tray file
 */
class StickerContentProvider : ContentProvider() {
  private lateinit var authority: String

  @Volatile private var cache: Pair<Long, List<Pack>>? = null

  override fun attachInfo(context: Context, info: ProviderInfo) {
    authority = info.authority
    if (!authority.startsWith(context.packageName)) {
      throw IllegalStateException("Sticker provider authority ($authority) must start with the package name ${context.packageName}")
    }
    super.attachInfo(context, info)
  }

  override fun onCreate(): Boolean = true

  // region data

  data class Sticker(val imageFile: String, val emojis: List<String>, val accessibilityText: String?)

  data class Pack(
    val identifier: String,
    val name: String,
    val publisher: String,
    val trayImageFile: String,
    val imageDataVersion: String,
    val avoidCache: Boolean,
    val animated: Boolean,
    val publisherEmail: String,
    val publisherWebsite: String,
    val privacyPolicyWebsite: String,
    val licenseAgreementWebsite: String,
    val stickers: List<Sticker>,
  )

  private val rootDir: File get() = File(requireNotNull(context).filesDir, "stickerpaw")
  private val contentsFile: File get() = File(rootDir, "whatsapp/contents.json")

  /** Re-reads contents.json whenever the app rewrote it (packs change at runtime). */
  @Synchronized
  private fun packs(): List<Pack> {
    val file = contentsFile
    if (!file.exists()) return emptyList()
    val stamp = file.lastModified() xor file.length()
    cache?.let { if (it.first == stamp) return it.second }
    val parsed = try {
      parse(JSONObject(file.readText()))
    } catch (e: Exception) {
      Log.e(TAG, "contents.json is invalid", e)
      emptyList()
    }
    cache = stamp to parsed
    return parsed
  }

  private fun parse(json: JSONObject): List<Pack> {
    val array = json.optJSONArray("sticker_packs") ?: return emptyList()
    return (0 until array.length()).map { i ->
      val p = array.getJSONObject(i)
      val stickers = p.getJSONArray("stickers")
      Pack(
        identifier = p.getString("identifier"),
        name = p.getString("name"),
        publisher = p.getString("publisher"),
        trayImageFile = p.getString("tray_image_file"),
        imageDataVersion = p.optString("image_data_version", "1"),
        avoidCache = p.optBoolean("avoid_cache", false),
        animated = p.optBoolean("animated_sticker_pack", false),
        publisherEmail = p.optString("publisher_email", ""),
        publisherWebsite = p.optString("publisher_website", ""),
        privacyPolicyWebsite = p.optString("privacy_policy_website", ""),
        licenseAgreementWebsite = p.optString("license_agreement_website", ""),
        stickers = (0 until stickers.length()).map { j ->
          val s = stickers.getJSONObject(j)
          val emojis = s.optJSONArray("emojis")
          Sticker(
            imageFile = s.getString("image_file"),
            emojis = if (emojis == null) emptyList() else (0 until emojis.length()).map { emojis.getString(it) }.filter { it.isNotEmpty() },
            accessibilityText = if (s.has("accessibility_text")) s.getString("accessibility_text") else null,
          )
        },
      )
    }
  }

  // endregion

  override fun query(uri: Uri, projection: Array<String>?, selection: String?, selectionArgs: Array<String>?, sortOrder: String?): Cursor {
    val segments = uri.pathSegments
    return when {
      segments.size == 1 && segments[0] == METADATA -> packCursor(uri, packs())
      segments.size == 2 && segments[0] == METADATA -> packCursor(uri, packs().filter { it.identifier == segments[1] })
      segments.size == 2 && segments[0] == STICKERS -> stickerCursor(uri, segments[1])
      else -> throw IllegalArgumentException("Unknown URI: $uri")
    }
  }

  override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
    val segments = uri.pathSegments
    if (segments.size != 3 || segments[0] != STICKERS_ASSET) return null
    val identifier = segments[1]
    val fileName = segments[2]
    // Only serve files that are listed in the pack (no path traversal).
    val pack = packs().firstOrNull { it.identifier == identifier } ?: return null
    val listed = fileName == pack.trayImageFile || pack.stickers.any { it.imageFile == fileName }
    if (!listed || fileName.contains('/') || identifier.contains('/') || identifier.contains("..")) return null
    val file = File(rootDir, "packs/$identifier/$fileName")
    if (!file.exists()) {
      Log.e(TAG, "Missing sticker file: $file")
      return null
    }
    return AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY), 0, AssetFileDescriptor.UNKNOWN_LENGTH)
  }

  override fun getType(uri: Uri): String {
    val segments = uri.pathSegments
    return when {
      segments.size == 1 && segments[0] == METADATA -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
      segments.size == 2 && segments[0] == METADATA -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
      segments.size == 2 && segments[0] == STICKERS -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
      segments.size == 3 && segments[0] == STICKERS_ASSET -> if (segments[2].endsWith(".png")) "image/png" else "image/webp"
      else -> throw IllegalArgumentException("Unknown URI: $uri")
    }
  }

  private fun packCursor(uri: Uri, packs: List<Pack>): Cursor {
    val cursor = MatrixCursor(
      arrayOf(
        "sticker_pack_identifier",
        "sticker_pack_name",
        "sticker_pack_publisher",
        "sticker_pack_icon",
        "android_play_store_link",
        "ios_app_download_link",
        "sticker_pack_publisher_email",
        "sticker_pack_publisher_website",
        "sticker_pack_privacy_policy_website",
        "sticker_pack_license_agreement_website",
        "image_data_version",
        "whatsapp_will_not_cache_stickers",
        "animated_sticker_pack",
      ),
    )
    for (p in packs) {
      cursor.newRow()
        .add(p.identifier)
        .add(p.name)
        .add(p.publisher)
        .add(p.trayImageFile)
        .add("")
        .add("")
        .add(p.publisherEmail)
        .add(p.publisherWebsite)
        .add(p.privacyPolicyWebsite)
        .add(p.licenseAgreementWebsite)
        .add(p.imageDataVersion)
        .add(if (p.avoidCache) 1 else 0)
        .add(if (p.animated) 1 else 0)
    }
    cursor.setNotificationUri(requireNotNull(context).contentResolver, uri)
    return cursor
  }

  private fun stickerCursor(uri: Uri, identifier: String): Cursor {
    val cursor = MatrixCursor(arrayOf("sticker_file_name", "sticker_emoji", "sticker_accessibility_text"))
    packs().firstOrNull { it.identifier == identifier }?.stickers?.forEach { s ->
      cursor.addRow(arrayOf<Any?>(s.imageFile, s.emojis.joinToString(","), s.accessibilityText))
    }
    cursor.setNotificationUri(requireNotNull(context).contentResolver, uri)
    return cursor
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException("Not supported")
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = throw UnsupportedOperationException("Not supported")
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int =
    throw UnsupportedOperationException("Not supported")

  companion object {
    private const val TAG = "StickerContentProvider"
    const val METADATA = "metadata"
    const val STICKERS = "stickers"
    const val STICKERS_ASSET = "stickers_asset"
    const val AUTHORITY_SUFFIX = ".stickercontentprovider"
  }
}
