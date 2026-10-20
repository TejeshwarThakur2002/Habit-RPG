import { colors } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder that proves the workspace boots; the Quests tab replaces it in P2.
export default function Home() {
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Habit RPG
      </Text>
      <Text style={styles.body}>Phase 0: the app boots.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.bg,
  },
  title: { color: colors.gold, fontSize: 22, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14 },
});
