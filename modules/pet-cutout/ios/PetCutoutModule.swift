import CoreImage
import ExpoModulesCore
import UIKit
import Vision

/// Background removal for pets (and people) with Vision's foreground instance mask.
/// `VNGenerateForegroundInstanceMaskRequest` is iOS 17+ and segments animals, unlike the older
/// person-only segmentation request.
public class PetCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PetCutout")

    Function("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    // AsyncFunction bodies run off the JS thread, so the Vision work does not block the UI.
    AsyncFunction("removeBackground") { (uri: String) -> [String: Any] in
      guard #available(iOS 17.0, *) else {
        throw UnsupportedException()
      }
      return try PetCutout.removeBackground(uri: uri)
    }
  }
}

// Expo derives the JS error code from the class name: UnsupportedException → "ERR_UNSUPPORTED".
final class UnsupportedException: Exception {
  override var reason: String { "Background removal needs iOS 17 or newer" }
}

final class NoSubjectException: Exception {
  override var reason: String { "No foreground subject found" }
}

final class CutoutException: GenericException<String> {
  override var reason: String { param }
}

enum PetCutout {
  @available(iOS 17.0, *)
  static func removeBackground(uri: String) throws -> [String: Any] {
    guard let url = URL(string: uri), let image = UIImage(contentsOfFile: url.path) else {
      throw CutoutException("Could not read image at \(uri)")
    }
    guard let cgImage = upright(image) else {
      throw CutoutException("Could not decode image")
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
    do {
      try handler.perform([request])
    } catch {
      // Vision's segmentation models are not available in some simulators.
      throw CutoutException("Vision failed: \(error.localizedDescription)")
    }

    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      throw NoSubjectException()
    }

    // Keep every detected instance (e.g. two pets); the touch-up brush can erase extras.
    let buffer = try observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    )
    let ciImage = CIImage(cvPixelBuffer: buffer)
    let context = CIContext(options: nil)
    guard let output = context.createCGImage(ciImage, from: ciImage.extent),
          let png = UIImage(cgImage: output).pngData() else {
      throw CutoutException("Could not encode the cut-out")
    }

    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("pet-cutout", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("\(UUID().uuidString).png")
    try png.write(to: file)

    return ["uri": file.absoluteString, "width": output.width, "height": output.height]
  }

  /// Redraws the image so its pixels match the displayed orientation (EXIF applied).
  private static func upright(_ image: UIImage) -> CGImage? {
    if image.imageOrientation == .up, let cg = image.cgImage {
      return cg
    }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
    return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: image.size)) }.cgImage
  }
}
