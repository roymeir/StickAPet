import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAppStore } from '@/state/appStore';

import { darkPalette, lightPalette, type Palette } from './palette';

export * from './palette';

export interface Theme {
  dark: boolean;
  colors: Palette;
}

const ThemeContext = createContext<Theme>({ dark: false, colors: lightPalette });

export function ThemeProvider({ children, forced }: { children: ReactNode; forced?: 'light' | 'dark' }) {
  const mode = useAppStore((s) => s.data.settings.theme);
  const system = useColorScheme();
  const dark = forced ? forced === 'dark' : mode === 'system' ? system === 'dark' : mode === 'dark';
  const value = useMemo(() => ({ dark, colors: dark ? darkPalette : lightPalette }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
