/**
 * Art styles. Adding a style is a config change only: add an entry here, a thumbnail in
 * assets/styles/, and (optionally) regenerate thumbnails with `npm run assets`.
 *
 * Prompt rules: describe the look in generic visual terms. Never name studios, franchises,
 * brands or living artists.
 */
export type StyleId =
  | 'classic'
  | 'anime'
  | 'cartoon'
  | 'animated3d'
  | 'chibi'
  | 'comic'
  | 'watercolor'
  | 'pixel'
  | 'popart'
  | 'clay';

export interface StickerStyle {
  id: StyleId;
  name: { he: string; en: string };
  /** Short tagline shown under the name in the carousel. */
  tagline: { he: string; en: string };
  /** Bundled image (Metro asset id from `require`). */
  thumbnail: number;
  /** `null` = no AI: the real photo, cut out. */
  prompt: string | null;
}

/** Appended to every AI prompt. */
export const SHARED_RULES =
  'Keep the pet recognizable: same breed, fur colors, markings and eye color. ' +
  'Single subject, centered, plain white background, no text, no frame.';

/** Framing instructions shared by every style, placed before the style description. */
export const FRAMING =
  'Redraw the pet from the input photo as a sticker illustration. Show only the pet, alone, ' +
  'centered, either full body or head-and-shoulders, filling most of the image with a little ' +
  'empty space around it. Background: plain flat pure white (#FFFFFF), no shadows on the ' +
  'background, no scenery, no props, no other animals or people.';

export const STYLES: readonly StickerStyle[] = [
  {
    id: 'classic',
    name: { he: 'קלאסי', en: 'Classic' },
    tagline: { he: 'התמונה האמיתית, גזורה', en: 'Your real photo, cut out' },
    thumbnail: require('../../assets/styles/classic.png'),
    prompt: null,
  },
  {
    id: 'anime',
    name: { he: 'אנימה', en: 'Anime' },
    tagline: { he: 'עיניים גדולות וקווים נקיים', en: 'Big eyes, clean lines' },
    thumbnail: require('../../assets/styles/anime.png'),
    prompt:
      'Style: cel-shaded Japanese-animation-inspired illustration. Large, expressive, glossy eyes ' +
      'with bright catchlights, clean confident line art with varying line weight, two-tone cel ' +
      'shading with crisp shadow shapes, soft rim highlights on the fur, gentle pastel-leaning ' +
      'colors, a cheerful and endearing expression.',
  },
  {
    id: 'cartoon',
    name: { he: 'קרטון', en: 'Cartoon' },
    tagline: { he: 'צבעים שטוחים וקו עבה', en: 'Flat colors, thick outlines' },
    thumbnail: require('../../assets/styles/cartoon.png'),
    prompt:
      'Style: bold, friendly 2D cartoon. Thick, even dark outlines, simplified rounded shapes, ' +
      'flat bright saturated colors with at most one simple shade per color, slightly exaggerated ' +
      'happy expression, vector-like finish suitable for a sticker.',
  },
  {
    id: 'animated3d',
    name: { he: 'תלת-ממד', en: '3D Animated' },
    tagline: { he: 'כמו דמות מסרט אנימציה', en: 'Like an animated-movie hero' },
    thumbnail: require('../../assets/styles/animated3d.png'),
    prompt:
      'Style: cute 3D animated-feature-film character render. Soft rounded proportions, slightly ' +
      'oversized head and eyes, plush detailed fur with subsurface softness, warm soft studio ' +
      'lighting with a gentle key light and rim light, smooth global illumination, appealing ' +
      'friendly expression, high-quality CG render.',
  },
  {
    id: 'chibi',
    name: { he: "צ'יבי", en: 'Chibi' },
    tagline: { he: 'ראש ענק, גוף קטנטן', en: 'Huge head, tiny body' },
    thumbnail: require('../../assets/styles/chibi.png'),
    prompt:
      'Style: super-deformed kawaii chibi illustration. Head about as large as the whole body, ' +
      'tiny stubby paws and body, huge sparkly eyes, small blush marks on the cheeks, simple ' +
      'clean outlines, soft pastel shading, adorable playful pose.',
  },
  {
    id: 'comic',
    name: { he: 'קומיקס', en: 'Comic book' },
    tagline: { he: 'דיו, רסטר וצבעים חזקים', en: 'Ink, halftone, punchy color' },
    thumbnail: require('../../assets/styles/comic.png'),
    prompt:
      'Style: classic comic-book illustration. Bold black inked contour lines with brush-like ' +
      'weight variation, hatching and halftone-dot shading, punchy saturated primary colors, ' +
      'strong dramatic lighting, dynamic heroic attitude.',
  },
  {
    id: 'watercolor',
    name: { he: 'צבעי מים', en: 'Watercolor' },
    tagline: { he: 'רך, עם מרקם נייר', en: 'Soft, with paper texture' },
    thumbnail: require('../../assets/styles/watercolor.png'),
    prompt:
      'Style: soft watercolor painting. Transparent layered washes, gentle color bleeds and ' +
      'blooms inside the pet, visible cold-press paper grain, loose expressive edges that stay ' +
      'within the silhouette, a few fine pencil or ink accents on the eyes and nose. The paper ' +
      'around the pet stays clean pure white.',
  },
  {
    id: 'pixel',
    name: { he: 'פיקסל ארט', en: 'Pixel art' },
    tagline: { he: 'ספרייט רטרו', en: 'Retro game sprite' },
    thumbnail: require('../../assets/styles/pixel.png'),
    prompt:
      'Style: retro video-game pixel-art sprite, as if drawn on a 48x48 pixel grid and scaled up ' +
      'with hard square pixels. Limited palette of about 12 colors, one-pixel dark outline, simple ' +
      'dithering for shading, no anti-aliasing, no blur.',
  },
  {
    id: 'popart',
    name: { he: 'פופ ארט', en: 'Pop art' },
    tagline: { he: 'ניגודיות גבוהה ונקודות', en: 'High contrast, halftone dots' },
    thumbnail: require('../../assets/styles/popart.png'),
    prompt:
      'Style: 1960s pop-art screen print. High contrast, only 3 to 4 bold flat colors plus black, ' +
      'thick black outlines, large visible halftone dots in the shadows and mid-tones, graphic ' +
      'poster look. Colors are applied to the pet only; the background stays plain white.',
  },
  {
    id: 'clay',
    name: { he: 'פלסטלינה / בובה', en: 'Clay / Plush' },
    tagline: { he: 'כמו צעצוע בעבודת יד', en: 'Like a handmade toy' },
    thumbnail: require('../../assets/styles/clay.png'),
    prompt:
      'Style: handmade toy figure, a mix of stop-motion modeling clay and soft felt plush. Visible ' +
      'fingerprints and tool marks in the clay, soft felt texture with tiny stitched seams, ' +
      'button-like glossy eyes, rounded chunky shapes, soft diffuse lighting like a small studio ' +
      'photo of a real toy.',
  },
];

export const DEFAULT_STYLE_ID: StyleId = 'classic';

export function getStyle(id: StyleId): StickerStyle {
  const style = STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`Unknown style: ${id}`);
  return style;
}

/** Full prompt sent to the image model, or null for styles that do not use AI. */
export function buildPrompt(style: Pick<StickerStyle, 'prompt'>): string | null {
  if (!style.prompt) return null;
  return `${FRAMING}\n\n${style.prompt}\n\n${SHARED_RULES}`;
}
