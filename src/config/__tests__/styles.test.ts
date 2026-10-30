import { buildPrompt, FRAMING, SHARED_RULES, STYLES } from '../styles';

// Studios, franchises, brands and artists we must never name in prompts.
const BANNED = [
  'pixar', 'disney', 'dreamworks', 'ghibli', 'miyazaki', 'marvel', ' dc ', 'pokemon', 'pokémon', 'nintendo', 'sanrio',
  'hello kitty', 'lego', 'aardman', 'wallace', 'gromit', 'simpsons', 'warhol', 'lichtenstein', 'minecraft', 'sonic',
  'looney', 'hanna', 'barbera', 'toei', 'sailor moon', 'naruto', 'one piece', 'laika', 'studio ghibli', 'cartoon network',
];

describe('styles config', () => {
  it('has the 10 requested styles with Hebrew + English names and thumbnails', () => {
    expect(STYLES.map((s) => s.id)).toEqual(['classic', 'anime', 'cartoon', 'animated3d', 'chibi', 'comic', 'watercolor', 'pixel', 'popart', 'clay']);
    for (const s of STYLES) {
      expect(s.name.he.trim()).not.toBe('');
      expect(s.name.en.trim()).not.toBe('');
      expect(s.tagline.he.trim()).not.toBe('');
      expect(s.thumbnail).toBeDefined();
    }
  });

  it('Classic uses no AI; every other style appends the shared rules', () => {
    expect(buildPrompt(STYLES[0]!)).toBeNull();
    for (const s of STYLES.slice(1)) {
      const p = buildPrompt(s)!;
      expect(p.startsWith(FRAMING)).toBe(true);
      expect(p.endsWith(SHARED_RULES)).toBe(true);
      expect(p).toContain('Keep the pet recognizable: same breed, fur colors, markings and eye color.');
      expect(p).toContain('plain white background, no text, no frame');
    }
  });

  it('never names studios, franchises or artists', () => {
    for (const s of STYLES) {
      const text = ` ${(buildPrompt(s) ?? '').toLowerCase()} `;
      for (const banned of BANNED) expect(text).not.toContain(banned);
    }
  });
});
