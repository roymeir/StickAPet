package expo.modules.whatsappstickers

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android side of "Add to WhatsApp", following the official sample:
 * AddStickerPackActivity (intent + chooser logic) and WhitelistCheck ("already added" state).
 */
class WhatsAppStickersModule : Module() {
  private var pendingAdd: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val authority: String
    get() = context.packageName + StickerContentProvider.AUTHORITY_SUFFIX

  override fun definition() = ModuleDefinition {
    Name("WhatsAppStickers")

    Function("getContentProviderAuthority") { authority }

    Function("notifyChanged") {
      val uri = Uri.Builder().scheme(ContentResolver.SCHEME_CONTENT).authority(authority).appendPath(StickerContentProvider.METADATA).build()
      context.contentResolver.notifyChange(uri, null)
    }

    AsyncFunction("getPackStatusAsync") { identifier: String ->
      val pm = context.packageManager
      val consumerInstalled = isPackageInstalled(CONSUMER_PACKAGE, pm)
      val businessInstalled = isPackageInstalled(BUSINESS_PACKAGE, pm)
      mapOf(
        "consumerInstalled" to consumerInstalled,
        "businessInstalled" to businessInstalled,
        "consumerAdded" to if (consumerInstalled) isWhitelisted(identifier, CONSUMER_PACKAGE) else null,
        "businessAdded" to if (businessInstalled) isWhitelisted(identifier, BUSINESS_PACKAGE) else null,
      )
    }

    AsyncFunction("addStickerPackAsync") { identifier: String, name: String, chooserTitle: String, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val pm = context.packageManager
      val consumerInstalled = isPackageInstalled(CONSUMER_PACKAGE, pm)
      val businessInstalled = isPackageInstalled(BUSINESS_PACKAGE, pm)
      if (!consumerInstalled && !businessInstalled) {
        promise.resolve(mapOf("status" to "not_installed"))
        return@AsyncFunction
      }
      val inConsumer = consumerInstalled && isWhitelisted(identifier, CONSUMER_PACKAGE) == true
      val inBusiness = businessInstalled && isWhitelisted(identifier, BUSINESS_PACKAGE) == true

      val intent = Intent().apply {
        action = "com.whatsapp.intent.action.ENABLE_STICKER_PACK"
        putExtra("sticker_pack_id", identifier)
        putExtra("sticker_pack_authority", authority)
        putExtra("sticker_pack_name", name)
      }
      // Same decision table as the sample: ask which app when the pack is in neither,
      // otherwise target the app that's still missing it. If it is in both (or the only
      // installed one), launch again anyway so WhatsApp can show its own "already added" UI.
      val launch: Intent = when {
        consumerInstalled && businessInstalled && !inConsumer && !inBusiness -> Intent.createChooser(intent, chooserTitle)
        consumerInstalled && !inConsumer -> intent.setPackage(CONSUMER_PACKAGE)
        businessInstalled && !inBusiness -> intent.setPackage(BUSINESS_PACKAGE)
        consumerInstalled -> intent.setPackage(CONSUMER_PACKAGE)
        else -> intent.setPackage(BUSINESS_PACKAGE)
      }
      pendingAdd?.resolve(mapOf("status" to "cancelled"))
      pendingAdd = promise
      try {
        activity.startActivityForResult(launch, ADD_PACK_REQUEST)
      } catch (e: ActivityNotFoundException) {
        pendingAdd = null
        promise.resolve(mapOf("status" to "not_installed"))
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != ADD_PACK_REQUEST) return@OnActivityResult
      val promise = pendingAdd ?: return@OnActivityResult
      pendingAdd = null
      if (payload.resultCode == Activity.RESULT_CANCELED) {
        val validationError = payload.data?.getStringExtra("validation_error")
        if (validationError != null) {
          promise.resolve(mapOf("status" to "validation_error", "message" to validationError))
        } else {
          promise.resolve(mapOf("status" to "cancelled"))
        }
      } else {
        promise.resolve(mapOf("status" to "ok"))
      }
    }
  }

  /** Port of the sample's WhitelistCheck.isWhitelistedFromProvider. null = can't tell (old WhatsApp). */
  private fun isWhitelisted(identifier: String, whatsappPackage: String): Boolean? {
    val providerAuthority = whatsappPackage + WHITELIST_PROVIDER_SUFFIX
    val providerInfo = context.packageManager.resolveContentProvider(providerAuthority, PackageManager.GET_META_DATA) ?: return null
    if (!providerInfo.enabled) return null
    val queryUri = Uri.Builder()
      .scheme(ContentResolver.SCHEME_CONTENT)
      .authority(providerAuthority)
      .appendPath("is_whitelisted")
      .appendQueryParameter("authority", authority)
      .appendQueryParameter("identifier", identifier)
      .build()
    return try {
      context.contentResolver.query(queryUri, null, null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getInt(cursor.getColumnIndexOrThrow("result")) == 1 else null
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun isPackageInstalled(packageName: String, pm: PackageManager): Boolean =
    try {
      pm.getApplicationInfo(packageName, 0).enabled
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  companion object {
    private const val ADD_PACK_REQUEST = 7200
    private const val CONSUMER_PACKAGE = "com.whatsapp"
    private const val BUSINESS_PACKAGE = "com.whatsapp.w4b"
    private const val WHITELIST_PROVIDER_SUFFIX = ".provider.sticker_whitelist_check"
  }
}
