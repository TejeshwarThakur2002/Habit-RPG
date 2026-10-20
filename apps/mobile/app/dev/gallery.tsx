import {
  Button,
  Chip,
  ReduceMotionProvider,
  ScreenHeader,
  StatBar,
  StatChip,
  SyncPill,
  colors,
  spacing,
  type,
  type ReduceMotionSetting,
} from '@habit-rpg/ui';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameComponentSections } from '@/features/dev/game-sections';
import { GallerySection as Section } from '@/features/dev/gallery-section';

// Dev-only gallery of every shared component in every state (SCOPE.md section 11, P1).
export default function Gallery() {
  const insets = useSafeAreaInsets();
  const [hp, setHp] = useState(42);
  const [xp, setXp] = useState(340);
  const [motion, setMotion] = useState<ReduceMotionSetting>('system');

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ReduceMotionProvider value={motion}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <ScreenHeader title="UI Gallery" right={<SyncPill status="synced" />} />

        <Section title="Reduce motion">
          <Text style={type.meta}>Current: {motion}</Text>
          <View style={styles.row}>
            {(['system', 'on', 'off'] as const).map((value) => (
              <Button
                key={value}
                label={value}
                variant={motion === value ? 'primary' : 'secondary'}
                onPress={() => setMotion(value)}
              />
            ))}
          </View>
        </Section>

        <Section title="StatBar">
          <StatBar label="HP" value={hp} max={50} color="red" />
          <StatBar label="XP" value={xp} max={500} color="teal" />
          <View style={styles.row}>
            <Button
              label="-8 HP"
              variant="secondary"
              onPress={() => setHp((v) => Math.max(0, v - 8))}
            />
            <Button
              label="+20 XP"
              variant="secondary"
              onPress={() => setXp((v) => (v + 20) % 500)}
            />
          </View>
        </Section>

        <Section title="Button">
          <Button label="Primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Danger" variant="danger" />
          <Button label="Disabled" disabled />
        </Section>

        <Section title="SyncPill">
          <SyncPill status="synced" />
          <SyncPill status="syncing" />
          <SyncPill status="offline" waiting={3} />
          <SyncPill status="error" />
        </Section>

        <Section title="Chip and StatChip">
          <View style={styles.row}>
            <Chip color="gold" label="128 gold" />
            <Chip color="orange" label="12-day streak" />
          </View>
          <View style={styles.row}>
            <StatChip label="STR" value={14} />
            <StatChip label="INT" value={19} onPress={() => undefined} />
          </View>
        </Section>
        <GameComponentSections />
      </ScrollView>
    </ReduceMotionProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: 48, gap: spacing.section },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.row, alignItems: 'center' },
});
