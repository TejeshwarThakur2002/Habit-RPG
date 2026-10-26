import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PixelifySans_500Medium,
  PixelifySans_700Bold,
  useFonts,
} from '@expo-google-fonts/pixelify-sans';
import { ReduceMotionProvider, colors } from '@habit-rpg/ui';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeroChoicePrompt } from '@/components/hero-choice-prompt';
import { SyncNotices } from '@/components/sync-notices';
import { db } from '@/db/client';
import { DatabaseGate } from '@/db/database-gate';
import { getSettings } from '@/db/queries/settings';
import { useDbQuery } from '@/db/use-db-query';
import { useReminders } from '@/features/reminders/use-reminders';
import { useAppArea } from '@/features/session/use-session';

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
    // Gesture Handler (drag to reorder) needs its root view above every screen.
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <DatabaseGate>
        <GuardedStack />
        <SyncNotices />
        <HeroChoicePrompt />
      </DatabaseGate>
    </GestureHandlerRootView>
  );
}

/** Only the routes for the current area are reachable (SCOPE.md section 5.3, route guards). */
function GuardedStack() {
  const area = useAppArea();
  // At the root rather than in the tabs, so signing out clears booked reminders too.
  useReminders();
  // The Reduce Motion choice from Settings reaches every animation.
  const reduceMotion = useDbQuery(() => getSettings(db).reduceMotion);
  return (
    <ReduceMotionProvider value={reduceMotion}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={area === 'sign-in'}>
          <Stack.Screen name="(auth)/sign-in" />
          <Stack.Screen name="(auth)/verify" />
        </Stack.Protected>
        <Stack.Protected guard={area === 'onboarding'}>
          <Stack.Screen name="(auth)/onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={area === 'tabs'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal/habit/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/link-account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/delete-account" options={{ presentation: 'modal' }} />
          {/* No swipe away: the player chooses, or puts it off with "Not now". */}
          <Stack.Screen
            name="modal/hero-choice"
            options={{ presentation: 'modal', gestureEnabled: false }}
          />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev/gallery" />
        </Stack.Protected>
      </Stack>
    </ReduceMotionProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
