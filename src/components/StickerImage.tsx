import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';

const checkerLight = require('../../assets/ui/checker-light.png');
const checkerDark = require('../../assets/ui/checker-dark.png');

/** Checkerboard backdrop so transparent sticker edges are visible. */
export function Checker({ children, style, rounded = true }: { children?: ReactNode; style?: ViewStyle; rounded?: boolean }) {
  const { dark } = useTheme();
  return (
    <ImageBackground
      source={dark ? checkerDark : checkerLight}
      resizeMode="repeat"
      style={[styles.checker, style]}
      imageStyle={rounded ? { borderRadius: radius.md } : undefined}
    >
      {children}
    </ImageBackground>
  );
}

export function StickerImage({
  uri,
  cacheKey,
  size,
  checker = true,
  accessibilityLabel,
}: {
  uri: string;
  cacheKey?: string;
  size: number;
  checker?: boolean;
  accessibilityLabel?: string;
}) {
  const img = (
    <Image
      source={{ uri, cacheKey }}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={120}
      accessibilityLabel={accessibilityLabel}
    />
  );
  if (!checker) return img;
  return <Checker style={{ width: size, height: size }}>{img}</Checker>;
}

const styles = StyleSheet.create({
  checker: { overflow: 'hidden', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
