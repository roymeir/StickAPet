// Generates every bitmap asset from SVG source so the art is reproducible and license-clean:
// app icon, splash, Android adaptive icon layers, favicon, UI checkerboard tiles, style
// thumbnails, the empty-state illustration and the demo stickers used by the web preview.
//
//   npm run assets
//
// The style thumbnails are hand-drawn approximations of each look. If you have an OpenAI key you
// can replace them with real AI renders of your own pet by dropping PNGs into assets/styles/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const OUT = 'assets';
const C = {
  coral: '#FF8A5B',
  tangerine: '#E4572E',
  cream: '#FFF6EC',
  brown: '#3B2A25',
  ginger: '#F39A4A',
  gingerDark: '#C96A23',
  pink: '#FF9DB0',
  teal: '#1F9E8F',
  sunny: '#FFC24B',
};

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

async function png(file, svgText, size) {
  mkdirSync(join(OUT, file.split('/').slice(0, -1).join('/')), { recursive: true });
  let img = sharp(Buffer.from(svgText));
  if (size) img = img.resize(size, size);
  await img.png({ compressionLevel: 9 }).toFile(join(OUT, file));
}

// ---------------------------------------------------------------------------------------------
// Cat face, parameterized per style. Drawn in a 512×512 box.
function catFace({
  fur = C.ginger,
  furDark = C.gingerDark,
  line = C.brown,
  lineWidth = 8,
  eye = 'dot',
  blush = false,
  shade = 'none',
  muzzle = '#FFF3E6',
  headScale = 1,
  body = false,
  smile = true,
  extraDefs = '',
  furFill,
} = {}) {
  const fill = furFill ?? fur;
  const s = headScale;
  const cx = 256;
  const cy = body ? 220 : 280;
  const rx = 170 * s;
  const ry = 150 * s;
  const ear = (dir) => {
    const x0 = cx + dir * rx * 0.85;
    const x1 = cx + dir * rx * 0.75;
    const x2 = cx + dir * rx * 0.2;
    const yb = cy - ry * 0.45;
    const yt = cy - ry * 1.45;
    return `<path d="M${x0},${yb} Q${x1},${yt - 10} ${x1 - dir * 10},${yt} Q${x2 + dir * 30},${cy - ry * 1.05} ${x2},${cy - ry * 0.8} Z" fill="${fill}" stroke="${line}" stroke-width="${lineWidth}" stroke-linejoin="round"/>
      <path d="M${cx + dir * rx * 0.68},${cy - ry * 0.62} Q${cx + dir * rx * 0.66},${yt + 40} ${cx + dir * rx * 0.62},${yt + 30} Q${cx + dir * rx * 0.4},${cy - ry * 0.95} ${cx + dir * rx * 0.36},${cy - ry * 0.82} Z" fill="${C.pink}" opacity="0.85"/>`;
  };
  const eyeR = eye === 'big' ? 40 * s : eye === 'huge' ? 52 * s : 20 * s;
  const ex = 70 * s;
  const ey = cy - 5;
  const eyes = [-1, 1]
    .map((d) => {
      const x = cx + d * ex;
      if (eye === 'dot') return `<ellipse cx="${x}" cy="${ey}" rx="${eyeR * 0.75}" ry="${eyeR}" fill="${line}"/><circle cx="${x + 6}" cy="${ey - 8}" r="6" fill="#fff"/>`;
      if (eye === 'pixel') return '';
      return `<ellipse cx="${x}" cy="${ey}" rx="${eyeR * 0.85}" ry="${eyeR}" fill="${line}"/>
        <ellipse cx="${x}" cy="${ey + eyeR * 0.15}" rx="${eyeR * 0.62}" ry="${eyeR * 0.7}" fill="#5FB36A"/>
        <ellipse cx="${x}" cy="${ey + eyeR * 0.2}" rx="${eyeR * 0.3}" ry="${eyeR * 0.5}" fill="${line}"/>
        <circle cx="${x + eyeR * 0.3}" cy="${ey - eyeR * 0.35}" r="${eyeR * 0.28}" fill="#fff"/>
        <circle cx="${x - eyeR * 0.3}" cy="${ey + eyeR * 0.4}" r="${eyeR * 0.12}" fill="#fff"/>`;
    })
    .join('');
  const shadeShape =
    shade === 'cel'
      ? `<path d="M${cx - rx * 0.95},${cy + 20} Q${cx},${cy + ry * 1.25} ${cx + rx * 0.95},${cy + 20} Q${cx + rx * 0.6},${cy + ry * 0.9} ${cx},${cy + ry * 0.95} Q${cx - rx * 0.6},${cy + ry * 0.9} ${cx - rx * 0.95},${cy + 20} Z" fill="${furDark}" opacity="0.55"/>`
      : shade === 'halftone'
        ? `<ellipse cx="${cx + 30}" cy="${cy + 50}" rx="${rx * 0.9}" ry="${ry * 0.75}" fill="url(#dots)"/>`
        : '';
  const bodyShape = body
    ? `<ellipse cx="${cx}" cy="430" rx="95" ry="70" fill="${fill}" stroke="${line}" stroke-width="${lineWidth}"/>
       <ellipse cx="${cx - 45}" cy="490" rx="28" ry="18" fill="${fill}" stroke="${line}" stroke-width="${lineWidth}"/>
       <ellipse cx="${cx + 45}" cy="490" rx="28" ry="18" fill="${fill}" stroke="${line}" stroke-width="${lineWidth}"/>`
    : '';
  return {
    defs: extraDefs,
    body: `${bodyShape}${ear(-1)}${ear(1)}
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${line}" stroke-width="${lineWidth}"/>
      ${shadeShape}
      <path d="M${cx - 40 * s},${cy - ry * 0.95} q12,40 0,70 M${cx},${cy - ry} q10,45 0,75 M${cx + 40 * s},${cy - ry * 0.95} q-12,40 0,70" stroke="${furDark}" stroke-width="${Math.max(6, lineWidth)}" fill="none" stroke-linecap="round"/>
      <ellipse cx="${cx}" cy="${cy + 62 * s}" rx="${75 * s}" ry="${52 * s}" fill="${muzzle}"/>
      ${eyes}
      <path d="M${cx - 16},${cy + 38 * s} Q${cx},${cy + 30 * s} ${cx + 16},${cy + 38 * s} Q${cx},${cy + 60 * s} ${cx - 16},${cy + 38 * s} Z" fill="#E5677D" stroke="${line}" stroke-width="${lineWidth * 0.5}"/>
      ${smile ? `<path d="M${cx - 30},${cy + 70 * s} Q${cx - 14},${cy + 88 * s} ${cx},${cy + 66 * s} Q${cx + 14},${cy + 88 * s} ${cx + 30},${cy + 70 * s}" stroke="${line}" stroke-width="${lineWidth * 0.7}" fill="none" stroke-linecap="round"/>` : ''}
      ${blush ? `<ellipse cx="${cx - 115 * s}" cy="${cy + 45 * s}" rx="${28 * s}" ry="${15 * s}" fill="#FF7E9A" opacity="0.6"/><ellipse cx="${cx + 115 * s}" cy="${cy + 45 * s}" rx="${28 * s}" ry="${15 * s}" fill="#FF7E9A" opacity="0.6"/>` : ''}
      <path d="M${cx - 95 * s},${cy + 55 * s} l-75,-12 M${cx - 95 * s},${cy + 70 * s} l-78,8 M${cx + 95 * s},${cy + 55 * s} l75,-12 M${cx + 95 * s},${cy + 70 * s} l78,8" stroke="${line}" stroke-width="${Math.max(3, lineWidth * 0.45)}" stroke-linecap="round" opacity="0.8"/>`,
  };
}

// White die-cut outline + soft shadow around any 512 art, scaled into a 480 box (16px margin).
async function stickerize(artSvg, { outline = 22, size = 512 } = {}) {
  const art = await sharp(Buffer.from(artSvg)).resize(size, size).png().toBuffer();
  const inner = size - 2 * (16 + outline + 6);
  const scaled = await sharp(art).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const off = (size - inner) / 2;
  const placed = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round(off), top: Math.round(off) }])
    .png()
    .toBuffer();
  const alpha = await sharp(placed).extractChannel(3).blur(outline / 2).linear(30, -30 * 255 * 0.03).toBuffer();
  const white = await sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  // sharp runs extract() before extend() within one pipeline, so shift in two passes.
  const shifted = await sharp(alpha).blur(4).linear(0.28, 0).extend({ top: 4, background: '#000' }).png().toBuffer();
  const shadowAlpha = await sharp(shifted).extract({ left: 0, top: 0, width: size, height: size }).png().toBuffer();
  const shadow = await sharp({ create: { width: size, height: size, channels: 3, background: '#2a140a' } })
    .joinChannel(shadowAlpha)
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: shadow, left: 0, top: 0 },
    { input: white, left: 0, top: 0 },
    { input: placed, left: 0, top: 0 },
  ]);
}

// ---------------------------------------------------------------------------------------------
const halftoneDefs = (color, r = 5, gap = 14) =>
  `<pattern id="dots" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><circle cx="${gap / 2}" cy="${gap / 2}" r="${r}" fill="${color}"/></pattern>`;

const styleArt = {
  anime: () => catFace({ fur: '#F7B26A', furDark: '#D9803A', lineWidth: 5, eye: 'huge', shade: 'cel', blush: true }),
  cartoon: () => catFace({ fur: '#FF9F2E', furDark: '#E07812', line: '#1d1d1d', lineWidth: 16, eye: 'dot', muzzle: '#FFFFFF' }),
  animated3d: () =>
    catFace({
      furFill: 'url(#g3d)',
      furDark: '#C9772F',
      line: 'none',
      lineWidth: 0,
      eye: 'big',
      blush: true,
      extraDefs: `<radialGradient id="g3d" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#FFD39A"/><stop offset="0.6" stop-color="#F59E4C"/><stop offset="1" stop-color="#B9611F"/></radialGradient>`,
    }),
  chibi: () => catFace({ fur: '#FFC48A', furDark: '#E99A55', lineWidth: 6, eye: 'big', blush: true, headScale: 0.95, body: true }),
  comic: () =>
    catFace({ fur: '#FFB13B', furDark: '#C2410C', line: '#111', lineWidth: 12, eye: 'dot', shade: 'halftone', extraDefs: halftoneDefs('#C2410C', 4, 12) }),
  watercolor: () =>
    catFace({
      fur: '#F4A261',
      furDark: '#E76F51',
      line: '#8a5a44',
      lineWidth: 3,
      eye: 'dot',
      muzzle: '#FFF8F0',
      extraDefs: `<filter id="wc"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="18"/><feGaussianBlur stdDeviation="1.2"/></filter>`,
    }),
  popart: () =>
    catFace({ fur: '#FFE14D', furDark: '#FF2E88', line: '#000', lineWidth: 14, eye: 'dot', shade: 'halftone', muzzle: '#FFFFFF', extraDefs: halftoneDefs('#FF2E88', 6, 16) }),
  clay: () =>
    catFace({
      furFill: 'url(#gclay)',
      furDark: '#B5652B',
      line: '#9C5A2B',
      lineWidth: 4,
      eye: 'dot',
      blush: true,
      extraDefs: `<radialGradient id="gclay" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#F8C089"/><stop offset="1" stop-color="#D98545"/></radialGradient>`,
    }),
};

const thumbBg = {
  classic: ['#FFE5D6', '#FFD0B8'],
  anime: ['#FFE3F1', '#E5D9FF'],
  cartoon: ['#D9F5FF', '#BDEBFF'],
  animated3d: ['#E3F4FF', '#FFF0D6'],
  chibi: ['#FFF0F5', '#FFE0EC'],
  comic: ['#FFF3B0', '#FFD84D'],
  watercolor: ['#F3F0E8', '#E9E3D6'],
  pixel: ['#2B2D42', '#3D405B'],
  popart: ['#00D1FF', '#00A6E0'],
  clay: ['#EAF6E9', '#D3EDD1'],
};

function thumbFrame(id) {
  const [a, b] = thumbBg[id];
  const extra =
    id === 'comic'
      ? `<path d="M256,40 L290,170 L420,120 L330,230 L470,280 L330,310 L400,440 L270,350 L210,480 L190,340 L60,400 L160,290 L40,220 L180,200 L120,80 L230,160 Z" fill="#FF5A36" opacity="0.85"/>`
      : id === 'popart'
        ? `<rect width="512" height="512" fill="url(#bgdots)"/>`
        : id === 'watercolor'
          ? `<rect width="512" height="512" filter="url(#paper)" opacity="0.35"/>`
          : '';
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <pattern id="bgdots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="5" fill="#FFFFFF" opacity="0.55"/></pattern>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="saturate" values="0"/></filter>`;
  return { defs, bg: `<rect width="512" height="512" fill="url(#bg)"/>${extra}` };
}

async function styleThumb(id) {
  const file = `styles/${id}.png`;
  let stickerPng;
  if (id === 'classic') {
    // The real photo test asset, cut out with an ellipse — exactly what "Classic" does.
    const photo = await sharp('assets/test/chelsea-cat.png').resize(512, 512, { fit: 'cover', position: 'centre' }).png().toBuffer();
    const mask = Buffer.from(svg(512, 512, '<ellipse cx="256" cy="250" rx="215" ry="225" fill="#fff"/>'));
    const cut = await sharp(photo).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    stickerPng = await (await stickerize(svg(512, 512, `<image href="data:image/png;base64,${cut.toString('base64')}" width="512" height="512"/>`))).png().toBuffer();
  } else if (id === 'pixel') {
    stickerPng = await (await stickerize(pixelCatSvg(), { outline: 18 })).png().toBuffer();
  } else {
    const face = styleArt[id]();
    const filterAttr = id === 'watercolor' ? ' filter="url(#wc)"' : '';
    const art = svg(512, 512, `<g${filterAttr}>${face.body}</g>`, face.defs);
    stickerPng = await (await stickerize(art)).png().toBuffer();
  }
  const frame = thumbFrame(id);
  const bg = await sharp(Buffer.from(svg(512, 512, frame.bg, frame.defs))).png().toBuffer();
  mkdirSync(join(OUT, 'styles'), { recursive: true });
  const full = await sharp(bg).composite([{ input: stickerPng }]).png().toBuffer();
  await sharp(full).resize(256, 256).png({ compressionLevel: 9 }).toFile(join(OUT, file));
}

function pixelCatSvg() {
  // 24×24 sprite: . transparent, o outline, f fur, d dark fur, w white, p pink, e eye
  const rows = [
    '........................',
    '..oo................oo..',
    '..ofo..............ofo..',
    '..offo............offo..',
    '..ofpfo..........ofpfo..',
    '..ofppfooooooooooofppfo.',
    '..offfffffdffdffffffffo.',
    '.offfffffffffffffffffffo',
    '.offfffffffffffffffffffo',
    '.offffeeffffffffffeefffo',
    '.offffewffffffffffewfffo',
    '.offffeeffffffffffeefffo',
    '.offfffffffppfffffffffo.',
    'oowfffwwwwwwwwwwwwfffwoo',
    '.offffwwwowwwwowwwffffo.',
    '.offffwwwwoowwowwwffffo.',
    '..offffwwwwwwwwwwffffo..',
    '...offffffffffffffffo...',
    '....offffffffffffffo....',
    '.....oooooooooooooo.....',
  ];
  const colors = { o: '#2B1B12', f: '#F5A040', d: '#C76A1E', w: '#FFF4E4', p: '#FF8FA8', e: '#1B1B1B' };
  const cell = 20;
  const ox = (512 - 24 * cell) / 2;
  const oy = (512 - rows.length * cell) / 2;
  let rects = '';
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (colors[ch]) rects += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}" fill="${colors[ch]}"/>`;
    }),
  );
  return svg(512, 512, rects);
}

// ---------------------------------------------------------------------------------------------
function mascot({ withBg }) {
  const face = catFace({ fur: C.ginger, furDark: C.gingerDark, lineWidth: 10, eye: 'big', blush: true });
  const sticker = `<g transform="translate(512 540) rotate(-8) translate(-256 -256)">
      <rect x="-6" y="-6" width="524" height="524" rx="150" fill="#2a140a" opacity="0.18" transform="translate(10 18)"/>
      <rect x="-6" y="-6" width="524" height="524" rx="150" fill="#ffffff"/>
      <rect x="22" y="22" width="468" height="468" rx="125" fill="${C.cream}"/>
      <g transform="translate(36 30) scale(0.86)">${face.body}</g>
      <path d="M420,512 Q470,470 512,420 L512,512 Z" fill="#F2DED0"/>
    </g>`;
  const bg = withBg
    ? `<rect width="1024" height="1024" fill="url(#bgicon)"/>
       <g fill="#ffffff" opacity="0.18">${paw(170, 190, 1)}${paw(860, 860, 0.8)}${paw(850, 170, 0.6)}</g>`
    : '';
  return svg(
    1024,
    1024,
    `${bg}${sticker}`,
    `<linearGradient id="bgicon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA36C"/><stop offset="1" stop-color="${C.tangerine}"/></linearGradient>${face.defs}`,
  );
}

function paw(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="30" rx="58" ry="48"/><ellipse cx="-62" cy="-30" rx="22" ry="30"/><ellipse cx="-22" cy="-62" rx="22" ry="30"/><ellipse cx="22" cy="-62" rx="22" ry="30"/><ellipse cx="62" cy="-30" rx="22" ry="30"/></g>`;
}

function emptyIllustration() {
  const cat = catFace({ fur: C.ginger, furDark: C.gingerDark, lineWidth: 9, eye: 'big', blush: true });
  const dog = catFace({ fur: '#C99B6D', furDark: '#8C6239', lineWidth: 9, eye: 'big', blush: true, muzzle: '#F5E6D3' });
  return svg(
    800,
    560,
    `<ellipse cx="400" cy="500" rx="330" ry="40" fill="#F3D9C4"/>
     <g transform="translate(330 70) rotate(6)">
       <rect width="300" height="380" rx="36" fill="#ffffff" stroke="#F0D9C7" stroke-width="6"/>
       <g fill="${C.coral}" opacity="0.9">${paw(85, 100, 0.45)}${paw(215, 110, 0.4)}${paw(150, 230, 0.5)}${paw(85, 330, 0.35)}${paw(215, 330, 0.38)}</g>
     </g>
     <g transform="translate(70 170) scale(0.62)">${cat.body}</g>
     <g transform="translate(470 210) scale(0.58)">
       <ellipse cx="90" cy="250" rx="45" ry="95" fill="#A87A4F" transform="rotate(25 90 250)"/>
       <ellipse cx="422" cy="250" rx="45" ry="95" fill="#A87A4F" transform="rotate(-25 422 250)"/>
       ${dog.body}
     </g>
     <g fill="${C.sunny}"><path d="M120,90 l10,25 l25,10 l-25,10 l-10,25 l-10,-25 l-25,-10 l25,-10z"/><path d="M700,70 l7,18 l18,7 l-18,7 l-7,18 l-7,-18 l-18,-7 l18,-7z"/></g>`,
    cat.defs,
  );
}

async function demoStickers() {
  const variants = [
    { fur: C.ginger, furDark: C.gingerDark, eye: 'big', blush: true },
    { fur: '#9E9E9E', furDark: '#616161', eye: 'dot' },
    { fur: '#3B3B3B', furDark: '#111', line: '#000', muzzle: '#EDEDED', eye: 'big' },
    { fur: '#F5E6D3', furDark: '#C9A27E', eye: 'huge', blush: true },
    { fur: '#C99B6D', furDark: '#8C6239', eye: 'dot', smile: false },
    { fur: '#FFB13B', furDark: '#C2410C', line: '#111', lineWidth: 12, eye: 'dot' },
  ];
  mkdirSync(join(OUT, 'demo'), { recursive: true });
  for (const [i, v] of variants.entries()) {
    const face = catFace({ lineWidth: 8, ...v });
    const st = await stickerize(svg(512, 512, face.body, face.defs));
    await st.webp({ quality: 80, alphaQuality: 100 }).toFile(join(OUT, `demo/sticker-${i + 1}.webp`));
  }
}

async function checker(file, a, b) {
  await png(file, svg(16, 16, `<rect width="16" height="16" fill="${a}"/><rect width="8" height="8" fill="${b}"/><rect x="8" y="8" width="8" height="8" fill="${b}"/>`));
}

// ---------------------------------------------------------------------------------------------
await png('icon.png', mascot({ withBg: true }), 1024);
await png('splash-icon.png', mascot({ withBg: false }), 1024);
await png('favicon.png', mascot({ withBg: true }), 48);
// Android adaptive icon: foreground art must sit inside the central 66% safe zone.
await png(
  'android-icon-foreground.png',
  svg(1024, 1024, `<g transform="translate(512 512) scale(0.62) translate(-512 -540)">${mascot({ withBg: false }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`),
  1024,
);
await png('android-icon-background.png', svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#g)"/>`, `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA36C"/><stop offset="1" stop-color="${C.tangerine}"/></linearGradient>`), 1024);
await png('android-icon-monochrome.png', svg(1024, 1024, `<g fill="#fff">${paw(512, 530, 2.2)}</g>`), 1024);
await png('illustrations/empty.png', emptyIllustration());
await checker('ui/checker-light.png', '#FFFFFF', '#F2E6DC');
await checker('ui/checker-dark.png', '#3A2C26', '#2B211D');
for (const id of ['classic', 'anime', 'cartoon', 'animated3d', 'chibi', 'comic', 'watercolor', 'pixel', 'popart', 'clay']) await styleThumb(id);
await demoStickers();
writeFileSync(join(OUT, 'demo/README.md'), 'Generated by scripts/generate-assets.mjs. Used only by the web preview / demo data.\n');
console.log('assets generated');
