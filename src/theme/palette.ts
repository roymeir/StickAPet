export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  sunny: string;
  border: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  checkerA: string;
  checkerB: string;
  overlay: string;
  shadow: string;
};

/** Warm, playful palette: cream paper, coral/tangerine primary, teal accent. */
export const lightPalette: Palette = {
  background: '#FFF6EC',
  surface: '#FFFFFF',
  surfaceAlt: '#FDEADB',
  text: '#3B2A25',
  textMuted: '#86695E',
  primary: '#E4572E',
  primaryPressed: '#C94820',
  onPrimary: '#FFFFFF',
  primarySoft: '#FFE0D2',
  accent: '#1F9E8F',
  accentSoft: '#D3F1EC',
  sunny: '#FFC24B',
  border: '#F0D9C7',
  danger: '#C93B3B',
  dangerSoft: '#FBE1E1',
  success: '#2A8C5E',
  successSoft: '#DCF2E6',
  warning: '#9A6212',
  warningSoft: '#FFF0D2',
  checkerA: '#FFFFFF',
  checkerB: '#F2E6DC',
  overlay: 'rgba(59, 42, 37, 0.45)',
  shadow: '#7A4A33',
};

export const darkPalette: Palette = {
  background: '#1F1714',
  surface: '#2B211D',
  surfaceAlt: '#3A2C26',
  text: '#FCEFE6',
  textMuted: '#C7AA9C',
  primary: '#FF8A5B',
  primaryPressed: '#FF7340',
  onPrimary: '#2A120A',
  primarySoft: '#4A2A1E',
  accent: '#4FD1C0',
  accentSoft: '#1D3B37',
  sunny: '#FFC24B',
  border: '#46362F',
  danger: '#FF7A7A',
  dangerSoft: '#4A2323',
  success: '#5FD39B',
  successSoft: '#1E3A2D',
  warning: '#FFC266',
  warningSoft: '#43341C',
  checkerA: '#3A2C26',
  checkerB: '#2B211D',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Font family names registered by expo-font (see src/app/_layout.tsx). */
export const fonts = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  bold: 'Rubik_700Bold',
  heavy: 'Rubik_800ExtraBold',
} as const;

/** Minimum touch target (dp). Apple HIG says 44, Material says 48; we go big. */
export const TOUCH = 52;
