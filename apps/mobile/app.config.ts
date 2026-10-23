import type { ExpoConfig } from 'expo/config';

// Bundle id and platform choices: docs/DECISIONS.md D1. Portrait phones only (SCOPE.md section 2).
const config: ExpoConfig = {
  name: 'Habit RPG',
  slug: 'habit-rpg',
  scheme: 'habitrpg',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#14121F',
  ios: {
    bundleIdentifier: 'com.tejeshwar.habitrpg',
    supportsTablet: false,
  },
  android: {
    package: 'com.tejeshwar.habitrpg',
    adaptiveIcon: {
      backgroundColor: '#14121F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-router', 'expo-notifications', '@react-native-community/datetimepicker'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
