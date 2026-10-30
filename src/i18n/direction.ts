import { reloadAppAsync } from 'expo';
import { DevSettings, I18nManager, Platform } from 'react-native';

import type { Language } from '@/domain/types';

import { isRTL } from './index';

/**
 * Applies the layout direction for `lang`.
 *
 * React Native reads the RTL flag when the app starts, so flipping it needs a reload. We use
 * I18nManager.forceRTL (persisted natively) and then reload the JS app. `alreadyReloadedFor`
 * guards against a reload loop if the platform refuses the change.
 *
 * Returns true if a reload was triggered.
 */
export async function applyLayoutDirection(
  lang: Language,
  alreadyReloadedFor: Language | null | undefined,
  markReloaded: (lang: Language | null) => Promise<void>,
): Promise<boolean> {
  const rtl = isRTL(lang);

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }

  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  I18nManager.swapLeftAndRightInRTL(true);

  if (I18nManager.isRTL === rtl) {
    if (alreadyReloadedFor) await markReloaded(null);
    return false;
  }
  if (alreadyReloadedFor === lang) {
    // We already reloaded once for this language and it didn't stick; don't loop.
    return false;
  }
  await markReloaded(lang);
  try {
    await reloadAppAsync('Layout direction changed');
  } catch {
    if (__DEV__) DevSettings.reload();
  }
  return true;
}
