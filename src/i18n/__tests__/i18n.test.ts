import { en } from '../en';
import { he } from '../he';
import { makeI18n, pluralCategory, translate } from '../index';

const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();

describe('i18n', () => {
  it('Hebrew and English have the same keys, no empty strings and the same placeholders', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(he[key].trim()).not.toBe('');
      expect(placeholders(he[key])).toEqual(placeholders(en[key]));
    }
  });

  it('Hebrew is the RTL default with a dual plural form', () => {
    const hebrew = makeI18n('he');
    expect(hebrew.rtl).toBe(true);
    expect(makeI18n('en').rtl).toBe(false);
    expect(pluralCategory('he', 2)).toBe('two');
    expect(pluralCategory('en', 2)).toBe('other');
    expect(hebrew.tp('home.stickers', 1)).toBe('סטיקר אחד');
    expect(hebrew.tp('home.stickers', 2)).toBe('שני סטיקרים');
    expect(hebrew.tp('home.stickers', 7)).toBe('7 סטיקרים');
    expect(makeI18n('en').tp('home.stickers', 7)).toBe('7 stickers');
  });

  it('interpolates parameters', () => {
    expect(translate('en', 'settings.cost', { cost: '0.03' })).toBe('Estimated cost per generation: about $0.03');
    expect(translate('he', 'new.step', { current: 2, total: 5 })).toBe('שלב 2 מתוך 5');
  });
});
