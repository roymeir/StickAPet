# Decisions

Choices made while building Stickerpaw without stopping to ask, with the reasoning. Newest
context first where it matters.

## Platform and stack

- **Expo SDK 58** (latest on npm, 2026-10-30) — React Native 0.88, React 19, New
  Architecture, Expo Router with routes in `src/app`, development build (`expo-dev-client`).
  Versions were pinned with `npx expo install` (offline mode, from Expo's bundled
  compatibility map, because `api.expo.dev` was unreachable from the build machine).
- **Two local Expo modules instead of one**: `modules/pet-cutout` (background removal) and
  `modules/whatsapp-stickers` (WhatsApp handoff). They change for different reasons, and each
  stays small. Each has its own config plugin so `npx expo prebuild --clean` regenerates
  everything; `ios/` and `android/` are git-ignored.
- **Minimum iOS stays at Expo's default** (16.4 in the generated Podfile) rather than 17.
  The animal-capable Vision request is iOS 17+, so on iOS 16 the app runs but the cut-out step
  shows a clear "needs iOS 17" message. Raise `ios.deploymentTarget` with
  `expo-build-properties` if you'd rather hide the app from iOS 16 devices.
- **Android minSdk 24** (Expo default, also ML Kit's requirement), pinned via
  `expo-build-properties` so it can't silently change.

## Image processing

- **@shopify/react-native-skia does everything**: compositing, the outline, shadow, caption
  text, touch-up, PNG/WebP encoding. Before relying on it I checked the prebuilt native
  libraries shipped by RN Skia 2.14 for iOS and Android: both contain `SkWebpEncoder`
  (libwebp), so **no native WebP code was needed**. Every export is re-parsed
  (`src/lib/webp.ts`) to prove 512×512, alpha present, static, ≤100 KB.
- **Quality search**: try q92 first (most stickers fit), else binary-search down to q5;
  alpha stays lossless inside lossy WebP. If even q5 is too big the user is told to use a
  thinner outline / shorter caption.
- **Outline = blur + alpha threshold**, not Skia's dilate filter (its kernel is a square,
  which gives boxy corners). σ = outline/2 with a threshold at Φ(−2) grows edges by ~2σ.
- **Layout**: subject is cropped to its alpha bounds and scaled into 512 − 2×16 px minus room
  for the outline and shadow, so nothing touches the 16 px margin (tested). Captions shrink
  to fit two lines and overlap the subject's bottom slightly, like hand-made stickers.
- **RTL captions**: Skia's paragraph engine runs Unicode bidi on both platforms (Android uses
  ICU, iOS RN Skia ships an ICU bidi subset; CanvasKit in tests does too — verified by
  measuring glyph positions), so we only set the paragraph base direction.
- **Corner emoji** uses the system color-emoji font through Skia's default font manager. It
  doesn't render in CanvasKit (unit tests / web preview), which have no emoji font.
- **Tray icon**: 96×96 PNG (PNG is what the iOS API requires), cropped to the first
  sticker's visible bounds so it isn't mostly margin.
- **Touch-up**: strokes are stored in image pixels and replayed in order (erase = clear,
  restore = original pixels through the stroke); the brush uses React Native's responder
  system so it doesn't fight a ScrollView. No pinch-zoom (kept simple).

## Background removal

- **Android: ML Kit's foreground *confidence mask* as alpha** instead of its pre-cut
  foreground bitmap — it keeps soft, anti-aliased fur edges. The model is unbundled (Play
  services): the config plugin adds the `com.google.mlkit.vision.DEPENDENCIES` meta-data so
  it downloads at install time, and for sideloaded APKs the module warms it up with a tiny
  segmentation request when the wizard opens (deliberately not the `ModuleInstall` API, to
  avoid depending on an interface I couldn't verify without the Android SDK).
- **ML Kit version pinned to `16.0.0-beta1`** — Google's Maven (`dl.google.com`) was not
  reachable from the build machine to check for a newer release. Bump it in
  `modules/pet-cutout/android/build.gradle` if there is one.
- **iOS keeps all detected instances** (e.g. two pets); the eraser removes extras.
- **Web/tests fallback**: a border flood-fill of light backgrounds. Good enough for AI
  renders on white, not for photos — it's only there so the UI can be previewed.

## WhatsApp

- **Android `contents.json` uses the official sample's schema**, written by JS on every
  change to `files/stickerpaw/whatsapp/contents.json`; the ContentProvider is a Kotlin port of
  the sample's, except it reads app storage, re-reads the manifest when it changes, and serves
  only files listed in a pack (no path traversal). Authority =
  `<package>.stickercontentprovider` as in the sample.
- **Add flow** mirrors `AddStickerPackActivity`: chooser when both WhatsApp and WhatsApp
  Business are installed and neither has the pack, otherwise target the one that's missing it;
  results (ok / cancelled / WhatsApp's validation_error) are reported back to JS.
  "Already added" uses the sample's whitelist provider query (Android only — iOS has no API).
- **Pack identifiers are generated** (`p` + base-36), because WhatsApp only allows
  `[a-zA-Z0-9_-.,' ]`; pack *names* can be Hebrew.
- **`image_data_version`** is bumped on every sticker add/delete/reorder/emoji change and when
  the tray changes. Renames don't change images, so they don't bump it.
- **Accessibility text** is generated in US English as WhatsApp's guidelines ask
  ("A pet sticker with text that reads "…"").
- **Validator** mirrors `StickerPackValidator.java` and runs on the real bytes before every
  hand-off, so problems are explained in the app instead of failing inside WhatsApp.
- **Share fallback shares a PNG**, not WebP: PNG works everywhere in the share sheet
  (save to Photos, WhatsApp's own "create sticker").

## AI

- **Model: `gpt-image-2.5-sunburst`**, kept in config and editable in Settings (with presets
  `gpt-image-2.5-flare`, `gpt-image-2`). platform/developers.openai.com and api.openai.com were
  blocked from the build machine, so I couldn't read the docs page directly; the choice comes
  from OpenAI's image-edit API reference as surfaced by web search (default edit model
  `gpt-image-2.5-sunburst`; `gpt-image-1` shut down on 2026-10-23). **Please confirm on
  the docs page**; changing it is a Settings tweak, not a release.
- **Request**: `model, image, prompt, n, size=1024x1024, quality`. We don't send
  `input_fidelity` (the gpt-image-2 docs say to omit it) or `background` (we always cut out on
  device anyway). If the API rejects `quality` or `size` for some model, the request is
  retried once without it.
- **Variants**: one request with `n` = 1 or 2 (Settings), so the input photo is billed once.
- **Prompts** describe looks generically (no studio/franchise/artist names — enforced by a
  test) and always end with the required shared rules; a framing paragraph asks for the pet
  alone on flat white.
- **Cost**: the Settings estimate uses token prices from third-party summaries of OpenAI's
  price list (the pricing page was blocked). After each generation the real cost is computed
  from the response's `usage`.
- **Cache** keyed by photo id + style + model + quality + variants + prompt hash, in memory
  and on disk (cache directory), so back/forward never re-bills; "Generate again" bypasses it.
- **Progress** is time-based (asymptotic bar + seconds counter): the edits endpoint gives no
  progress, and streaming partial images isn't available through React Native's fetch.
- **Live test** is a Jest test that skips itself unless `OPENAI_API_KEY` is set (env or
  `.env`). It could not be run here (no key, API blocked).

## App

- **Storage**: a JSON file (`db.json`, written atomically via temp file + move) instead of
  SQLite — the data is tiny (packs + settings). Images live next to it in the document
  directory. The OpenAI key is the only thing in expo-secure-store.
- **i18n**: a tiny typed module instead of i18next — `he.ts` must have exactly the keys of
  `en.ts` (compile-time), plus explicit Hebrew dual plurals; no Intl.PluralRules dependency on
  Hermes.
- **RTL**: `I18nManager.forceRTL` + `reloadAppAsync()` when the language changes (React Native
  reads direction at start), with a guard against reload loops. The root view also sets
  `direction` so layout is right even before the reload (and on web). iOS swaps text
  `left/right` in RTL while Android doesn't; `AppText` normalizes that.
- **Reordering stickers** uses "Move earlier / later / Use as pack icon" buttons in the sticker
  sheet instead of drag-and-drop: large targets, accessible, works the same in RTL, no extra
  native dependency.
- **Wizard state** lives in memory (zustand); cut-outs are cached by input image so stepping
  back and forth doesn't redo segmentation.
- **Style thumbnails** are hand-drawn SVG approximations generated by
  `scripts/generate-assets.mjs` (no AI images could be generated here). Replace
  `assets/styles/*.png` with real renders of your pet whenever you like.
- **Web preview** exists purely for fast UI iteration and screenshots (in-memory storage,
  flood-fill cut-out, no WhatsApp). The products are the iOS and Android apps.

## What could not be verified here

The build machine had no macOS/Xcode, no Android SDK (Google's download host was blocked),
no emulator (no KVM) and no network access to OpenAI. So the Swift and Kotlin modules were
written against the Expo Modules API sources in `node_modules` and WhatsApp's sample code but
**never compiled**, and WhatsApp/Vision/ML Kit/OpenAI were never exercised for real. What
*was* verified: typecheck, lint, 67 unit tests on real Skia, `expo prebuild` output (manifest
provider/queries/meta-data, Info.plist schemes/permissions/locales), module autolinking, and
the full UI in the web preview in both languages and both themes (with OpenAI mocked at the
network layer). See the README for the on-device self-test.
