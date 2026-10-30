import {
  BlendMode,
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';

import { draw, drawScaled } from './skia';

export type BrushMode = 'erase' | 'restore';

/** A brush stroke in image pixel coordinates. `points` is a flat [x0, y0, x1, y1, …] list. */
export interface Stroke {
  mode: BrushMode;
  width: number;
  points: number[];
}

export function strokeToPath(points: number[]): SkPath {
  const path = Skia.PathBuilder.Make();
  if (points.length < 2) return path.build();
  path.moveTo(points[0]!, points[1]!);
  if (points.length === 2) {
    // A tap: a zero-length segment still renders as a round dot.
    return path.lineTo(points[0]! + 0.01, points[1]!).build();
  }
  // Smooth with quadratic curves through segment midpoints.
  for (let i = 2; i < points.length - 2; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    path.quadTo(x, y, (x + points[i + 2]!) / 2, (y + points[i + 3]!) / 2);
  }
  return path.lineTo(points[points.length - 2]!, points[points.length - 1]!).build();
}

function strokePaint(width: number) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  return paint;
}

/**
 * Re-applies the user's brush strokes in order: "erase" clears alpha, "restore" paints the
 * original (pre-cut-out) pixels back in. Output has the cut-out's dimensions.
 */
export function applyStrokes(cutout: SkImage, original: SkImage, strokes: Stroke[]): SkImage {
  const w = cutout.width();
  const h = cutout.height();
  if (strokes.length === 0) return cutout;
  return draw(w, h, (canvas) => {
    canvas.drawImage(cutout, 0, 0);
    for (const stroke of strokes) {
      const path = strokeToPath(stroke.points);
      if (stroke.mode === 'erase') {
        const paint = strokePaint(stroke.width);
        paint.setBlendMode(BlendMode.Clear);
        canvas.drawPath(path, paint);
      } else {
        const area = Skia.Path.Stroke(path, { width: stroke.width, cap: StrokeCap.Round, join: StrokeJoin.Round });
        if (!area) continue;
        canvas.save();
        canvas.clipPath(area, ClipOp.Intersect, true);
        drawScaled(canvas, original, { x: 0, y: 0, width: original.width(), height: original.height() }, { x: 0, y: 0, width: w, height: h });
        canvas.restore();
      }
    }
  });
}
