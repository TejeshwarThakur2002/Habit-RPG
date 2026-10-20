import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PixelifySans_500Medium,
  PixelifySans_700Bold,
  useFonts,
} from '@expo-google-fonts/pixelify-sans';
import { colors } from '@habit-rpg/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// Keep the splash screen up until fonts load, so text never flashes in a fallback font.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // One useFonts call registers both families (DECISIONS.md D13).
  const [loaded, error] = useFonts({
    PixelifySans_500Medium,
    PixelifySans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  // A font error falls back to system fonts rather than leaving the user on the splash screen.
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
