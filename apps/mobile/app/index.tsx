import { Button, colors, type } from '@habit-rpg/ui';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder until the Quests tab replaces it in P2; in development it links to the gallery.
export default function Home() {
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={type.screenTitle}>
        Habit RPG
      </Text>
      <Text style={type.secondary}>Phase 1: building the UI kit.</Text>
      {__DEV__ && <Button label="Open UI gallery" onPress={() => router.push('/dev/gallery')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bg,
  },
});
