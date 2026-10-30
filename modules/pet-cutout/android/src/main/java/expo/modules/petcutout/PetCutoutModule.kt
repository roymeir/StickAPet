package expo.modules.petcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.roundToInt

/**
 * Background removal with ML Kit Subject Segmentation, which handles pets as well as people.
 * We ask for the per-pixel foreground confidence mask (not the pre-cut bitmap) and use it as
 * alpha, which keeps soft, anti-aliased fur edges.
 */
class PetCutoutModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun newSegmenter(): SubjectSegmenter =
    SubjectSegmentation.getClient(
      SubjectSegmenterOptions.Builder()
        .enableForegroundConfidenceMask()
        .build()
    )

  override fun definition() = ModuleDefinition {
    Name("PetCutout")

    Function("isSupported") { true }

    AsyncFunction("prepareAsync") { promise: Promise ->
      requestModelDownload { ready -> promise.resolve(ready) }
    }

    AsyncFunction("removeBackground") { uri: String, promise: Promise ->
      val bitmap = try {
        loadBitmap(Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_CUTOUT", "Could not read image: ${e.message}", e)
        return@AsyncFunction
      }

      val segmenter = newSegmenter()
      segmenter.process(InputImage.fromBitmap(bitmap, 0))
        .addOnSuccessListener(worker) { result ->
          try {
            val mask = result.foregroundConfidenceMask
            if (mask == null) {
              promise.reject("ERR_NO_SUBJECT", "No foreground subject found", null)
              return@addOnSuccessListener
            }
            val w = bitmap.width
            val h = bitmap.height
            val pixels = IntArray(w * h)
            bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
            mask.rewind()
            var visible = 0
            for (i in 0 until w * h) {
              val alpha = (mask.get() * 255f).roundToInt().coerceIn(0, 255)
              if (alpha > 128) visible++
              pixels[i] = (alpha shl 24) or (pixels[i] and 0x00FFFFFF)
            }
            if (visible < w * h / 200) { // less than 0.5% of the image
              promise.reject("ERR_NO_SUBJECT", "No foreground subject found", null)
              return@addOnSuccessListener
            }
            val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            out.setHasAlpha(true)
            out.setPixels(pixels, 0, w, 0, 0, w, h)

            val dir = File(context.cacheDir, "pet-cutout").apply { mkdirs() }
            val file = File(dir, "${UUID.randomUUID()}.png")
            FileOutputStream(file).use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
            out.recycle()
            promise.resolve(mapOf("uri" to Uri.fromFile(file).toString(), "width" to w, "height" to h))
          } catch (e: Exception) {
            promise.reject("ERR_CUTOUT", e.message ?: "Cut-out failed", e)
          } finally {
            segmenter.close()
          }
        }
        .addOnFailureListener(worker) { e ->
          segmenter.close()
          if (e is MlKitException && e.errorCode == MlKitException.UNAVAILABLE) {
            // The unbundled model hasn't been downloaded yet (common right after a sideload).
            requestModelDownload { }
            promise.reject("ERR_MODEL_DOWNLOADING", "The segmentation model is still downloading", e)
          } else {
            promise.reject("ERR_CUTOUT", e.message ?: "Cut-out failed", e)
          }
        }
    }

    OnDestroy {
      worker.shutdown()
    }
  }

  private fun requestModelDownload(done: (Boolean) -> Unit) {
    val segmenter = newSegmenter()
    val client = ModuleInstall.getClient(context)
    client.areModulesAvailable(segmenter)
      .addOnSuccessListener { response ->
        if (response.areModulesAvailable()) {
          segmenter.close()
          done(true)
        } else {
          client.installModules(ModuleInstallRequest.newBuilder().addApi(segmenter).build())
            .addOnCompleteListener {
              segmenter.close()
              done(false)
            }
        }
      }
      .addOnFailureListener {
        segmenter.close()
        done(false)
      }
  }

  private fun loadBitmap(uri: Uri): Bitmap {
    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    val decoded = when (uri.scheme) {
      "content" -> context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, options) }
      else -> BitmapFactory.decodeFile(uri.path, options)
    } ?: throw IllegalArgumentException("Unsupported image")
    return if (decoded.config == Bitmap.Config.ARGB_8888) decoded else decoded.copy(Bitmap.Config.ARGB_8888, false)
  }
}
