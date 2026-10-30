import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_700Bold,
  Rubik_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/rubik';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Settings } from '@/domain/types';
import { applyLayoutDirection } from '@/i18n/direction';
import { useI18n } from '@/i18n/useI18n';
import { useAppStore } from '@/state/appStore';
import { fonts, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Web preview only: `?lang=en&theme=dark` (used for screenshot checks of every screen). */
function applyWebPreviewOverrides() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  const lang = q.get('lang');
  const theme = q.get('theme');
  const patch: Partial<Settings> = {};
  if (lang === 'he' || lang === 'en') patch.language = lang;
  if (theme === 'light' || theme === 'dark' || theme === 'system') patch.theme = theme;
  if (Object.keys(patch).length) void useAppStore.getState().updateSettings(patch);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_700Bold, Rubik_800ExtraBold });
  const hydrated = useAppStore((s) => s.hydrated);
  const [directionReady, setDirectionReady] = useState(false);

  useEffect(() => {
    void useAppStore.getState().hydrate();
  }, []);

  // Once settings are loaded, make sure the native layout direction matches the language.
  useEffect(() => {
    if (!hydrated) return;
    applyWebPreviewOverrides();
    const { settings } = useAppStore.getState().data;
    void applyLayoutDirection(settings.language, settings.directionReloadFor, (lang) =>
      useAppStore.getState().updateSettings({ directionReloadFor: lang }),
    ).then((reloading) => {
      if (!reloading) setDirectionReady(true);
    });
  }, [hydrated]);

  const ready = fontsLoaded && hydrated && directionReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const { colors, dark } = useTheme();
  const { rtl } = useI18n();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  return (
    // `direction` keeps Yoga in sync with the chosen language even before a reload has
    // applied I18nManager (and it is what flips the layout in the web preview).
    <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr', backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="new" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
