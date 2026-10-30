import type { Language } from '@/domain/types';

import { en, type StringKey } from './en';
import { he } from './he';

export type { StringKey };
export const DICTIONARIES = { en, he } as const;
export const DEFAULT_LANGUAGE: Language = 'he';

type Params = Record<string, string | number>;

/** Keys that have plural variants, without the suffix (e.g. 'home.stickers'). */
type PluralBase = {
  [K in StringKey]: K extends `${infer B}_other` ? B : never;
}[StringKey];

export function pluralCategory(lang: Language, count: number): 'one' | 'two' | 'other' {
  if (count === 1) return 'one';
  // Hebrew has a dual form; English uses "other" for 2 (the `_two` English string just says 2).
  if (count === 2 && lang === 'he') return 'two';
  return 'other';
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (m, name: string) =>
    params[name] !== undefined ? String(params[name]) : m,
  );
}

export function translate(lang: Language, key: StringKey, params?: Params): string {
  return interpolate(DICTIONARIES[lang][key] ?? en[key] ?? key, params);
}

export function translatePlural(lang: Language, base: PluralBase, count: number, params?: Params): string {
  const dict = DICTIONARIES[lang] as Record<string, string>;
  const cat = pluralCategory(lang, count);
  const template = dict[`${base}_${cat}`] ?? dict[`${base}_other`] ?? base;
  return interpolate(template, { count, ...params });
}

export function isRTL(lang: Language): boolean {
  return lang === 'he';
}

export interface I18n {
  lang: Language;
  rtl: boolean;
  t: (key: StringKey, params?: Params) => string;
  tp: (base: PluralBase, count: number, params?: Params) => string;
  /** Picks the right field of a `{ he, en }` object (used by styles.ts). */
  pick: <T>(value: { he: T; en: T }) => T;
}

export function makeI18n(lang: Language): I18n {
  return {
    lang,
    rtl: isRTL(lang),
    t: (key, params) => translate(lang, key, params),
    tp: (base, count, params) => translatePlural(lang, base, count, params),
    pick: (value) => value[lang],
  };
}
