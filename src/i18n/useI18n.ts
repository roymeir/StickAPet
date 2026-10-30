import { useMemo } from 'react';

import { useAppStore } from '@/state/appStore';

import { type I18n, makeI18n } from './index';

export function useI18n(): I18n {
  const lang = useAppStore((s) => s.data.settings.language);
  return useMemo(() => makeI18n(lang), [lang]);
}
