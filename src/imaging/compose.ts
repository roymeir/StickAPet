import {
  PaintStyle,
  Skia,
  StrokeJoin,
  TextAlign,
  TextDirection,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { WA } from '@/whatsapp/limits';

import { alphaBounds, type Box } from './alpha';
import { draw, drawScaled, readRGBA } from './skia';

export interface StickerFonts {
  provider: SkTypefaceFontProvider;
  /** Family registered in `provider` (a bold font with Hebrew + Latin glyphs). */
  family: string;
}

export interface ComposeOptions {
  /** White outline thickness as a fraction of the output size (0 disables). */
  outlinePct: number;
  shadow: boolean;
  caption?: string;
  captionColor?: string;
  cornerEmoji?: string;
  size?: number;
  margin?: number;
}

export interface ComposeResult {
  image: SkImage;
  /** Where the subject landed (output pixels). Useful for tests and previews. */
  subject: Box;
  caption: Box | null;
}

const OUTLINE_COLOR = '#FFFFFF';
const CAPTION_STROKE = '#2A1A14';
const SHADOW_COLOR = 'rgba(40, 20, 10, 0.28)';

export const hasRtlChars = (text: string) => /[֐-׿؀-ۿ]/.test(text);

/**
 * Color matrix that turns a blurred alpha mask into a crisp, round, solid-white silhouette.
 * Blurring with sigma σ and keeping alpha above t≈0.023 grows a straight edge by ≈2σ
 * (Φ⁻¹(1 − 0.023) ≈ 2), so σ = outline / 2 gives an outline of the requested width with
 * rounded corners — unlike Skia's dilate filter, whose kernel is a square.
 */
export function outlineMatrix(sigma: number): number[] {
  const t = 0.0228;
  // Slope so the edge goes from 0 to 1 over about one pixel: d(alpha)/dx at the edge ≈ φ(2)/σ.
  const k = Math.max(8, (sigma * 1.1) / 0.054);
  return [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, k, -t * k];
}

function layoutCaption(text: string, fonts: StickerFonts, maxWidth: number, maxHeight: number, size: number) {
  // Skia's paragraph engine runs the Unicode bidi algorithm (ICU on Android, ICU subset on iOS,
  // also in CanvasKit), so we only set the base direction for Hebrew captions.
  const direction = hasRtlChars(text) ? TextDirection.RTL : TextDirection.LTR;
  const build = (fontSize: number, paintStyle: 'fill' | 'stroke' | 'halo', color: string, strokeWidth = 0, limitLines = true) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    if (paintStyle !== 'fill') {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(strokeWidth);
      paint.setStrokeJoin(StrokeJoin.Round);
    }
    const p = Skia.ParagraphBuilder.Make(
      limitLines
        ? { textAlign: TextAlign.Center, textDirection: direction, maxLines: 2, ellipsis: '…' }
        : { textAlign: TextAlign.Center, textDirection: direction },
      fonts.provider,
    )
      .pushStyle({ fontFamilies: [fonts.family], fontSize, fontStyle: { weight: 800 }, heightMultiplier: 1.05 }, paint)
      .addText(text)
      .pop()
      .build();
    p.layout(maxWidth);
    return p;
  };

  // Shrink the font until the caption fits in two lines and the height budget.
  let fontSize = Math.round(size * 0.15);
  const minSize = Math.round(size * 0.065);
  // Measure without the line limit so we can tell when text would be cut off.
  let measure: SkParagraph = build(fontSize, 'fill', '#fff', 0, false);
  while (fontSize > minSize) {
    const tooTall = measure.getHeight() > maxHeight;
    const tooWide = measure.getLongestLine() > maxWidth + 0.5;
    const tooManyLines = measure.getLineMetrics().length > 2;
    if (!tooTall && !tooWide && !tooManyLines) break;
    fontSize -= 3;
    measure = build(fontSize, 'fill', '#fff', 0, false);
  }
  const fill = build(fontSize, 'fill', '#fff');
  const darkStroke = Math.max(3, fontSize * 0.16);
  return {
    fontSize,
    height: fill.getHeight(),
    darkStroke,
    paragraphs: (color: string, haloWidth: number) => [
      ...(haloWidth > 0 ? [build(fontSize, 'halo', OUTLINE_COLOR, darkStroke + haloWidth * 2)] : []),
      build(fontSize, 'stroke', CAPTION_STROKE, darkStroke),
      build(fontSize, 'fill', color),
    ],
  };
}

function drawCornerEmoji(canvas: SkCanvas, emoji: string, size: number, margin: number) {
  const fontSize = Math.round(size * 0.19);
  try {
    // No font provider: on iOS/Android Skia falls back to the system color-emoji font.
    const p = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center })
      .pushStyle({ fontSize })
      .addText(emoji)
      .pop()
      .build();
    const box = fontSize * 1.4;
    p.layout(box);
    p.paint(canvas, size - margin - box, margin);
  } catch {
    // Platforms without a system emoji font (unit tests, web preview) just skip it.
  }
}

/**
 * Turns a cut-out (any size, transparent background) into a WhatsApp-ready 512×512 sticker:
 * crop to the subject, scale into the safe area, white outline, soft drop shadow, optional
 * caption at the bottom and emoji in the top corner. Everything stays inside a 16px margin.
 */
export function composeSticker(cutout: SkImage, opts: ComposeOptions, fonts?: StickerFonts | null): ComposeResult {
  const S = opts.size ?? WA.STICKER_SIZE;
  const M = opts.margin ?? WA.STICKER_MARGIN;
  const inner = S - 2 * M;

  const outline = Math.round(Math.min(Math.max(opts.outlinePct, 0), 0.1) * S);
  const shadowDy = opts.shadow ? Math.max(2, Math.round(S * 0.008)) : 0;
  const shadowSigma = opts.shadow ? S * 0.007 : 0;
  // Room the outline and shadow need around the subject so nothing touches the margin.
  const pad = outline + (opts.shadow ? Math.ceil(shadowDy + 3 * shadowSigma) : 1);

  const bounds = alphaBounds(readRGBA(cutout), cutout.width(), cutout.height());
  if (!bounds) throw new Error('EMPTY_CUTOUT');

  const captionText = opts.caption?.trim();
  const caption = captionText && fonts ? layoutCaption(captionText, fonts, inner - 2 * outline, S * 0.3, S) : null;
  const captionHalo = caption ? Math.max(2, Math.round(outline * 0.6)) : 0;
  const captionBlock = caption ? caption.height + caption.darkStroke + captionHalo : 0;
  // Let the caption overlap the bottom of the subject a little, like hand-made stickers.
  const captionIntrusion = caption ? captionBlock * 0.6 : 0;

  const area = { x: M + pad, y: M + pad, width: inner - 2 * pad, height: inner - 2 * pad - captionIntrusion };
  const scale = Math.min(area.width / bounds.width, area.height / bounds.height);
  const subject: Box = {
    width: bounds.width * scale,
    height: bounds.height * scale,
    x: 0,
    y: 0,
  };
  subject.x = area.x + (area.width - subject.width) / 2;
  subject.y = area.y + (area.height - subject.height) / 2;

  const subjectLayer = draw(S, S, (c) => drawScaled(c, cutout, bounds, subject));

  const silhouette =
    outline > 0
      ? draw(S, S, (c) => {
          const paint = Skia.Paint();
          paint.setImageFilter(
            Skia.ImageFilter.MakeColorFilter(
              Skia.ColorFilter.MakeMatrix(outlineMatrix(outline / 2)),
              Skia.ImageFilter.MakeBlur(outline / 2, outline / 2, TileMode.Decal, null),
            ),
          );
          c.drawImage(subjectLayer, 0, 0, paint);
        })
      : null;

  let captionBox: Box | null = null;
  const image = draw(S, S, (c) => {
    const base = silhouette ?? subjectLayer;
    if (opts.shadow) {
      const paint = Skia.Paint();
      paint.setImageFilter(Skia.ImageFilter.MakeDropShadowOnly(0, shadowDy, shadowSigma, shadowSigma, Skia.Color(SHADOW_COLOR), null));
      c.drawImage(base, 0, 0, paint);
    }
    if (silhouette) c.drawImage(silhouette, 0, 0);
    c.drawImage(subjectLayer, 0, 0);

    if (caption) {
      const width = inner - 2 * outline;
      const x = M + outline;
      const y = S - M - captionHalo - caption.darkStroke / 2 - caption.height;
      for (const p of caption.paragraphs(opts.captionColor ?? '#FFFFFF', captionHalo)) p.paint(c, x, y);
      captionBox = { x, y, width, height: caption.height };
    }
    if (opts.cornerEmoji) drawCornerEmoji(c, opts.cornerEmoji, S, M);
  });

  return { image, subject, caption: captionBox };
}
