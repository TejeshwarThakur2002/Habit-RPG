import {
  Button,
  Heatmap,
  ScreenHeader,
  borders,
  colors,
  radii,
  spacing,
  type,
} from '@habit-rpg/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Stats } from '@/db/queries/stats';

import { Card } from './card';
import { QuestRates } from './quest-rates';

export interface StatsViewProps {
  stats: Stats;
  demo: boolean;
  onEditHabit: (habitId: string) => void;
  /** Temporary until Settings exists: wipes local data and returns to sign-in. */
  onReset: () => void;
}

/** "Adventure Log" (SCOPE.md section 5.7). */
export function StatsView({ stats, demo, onEditHabit, onReset }: StatsViewProps) {
  const insets = useSafeAreaInsets();
  const month = stats.monthPercent === null ? '–' : `${stats.monthPercent}%`;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <ScreenHeader title="Adventure Log" />
      <View style={styles.tiles}>
        <Tile value={`${stats.streak}`} label="day streak" color={colors.orange} />
        <Tile value={month} label="this month" color={colors.teal} />
        <Tile value={`${stats.bossesBeaten}`} label="bosses beaten" color={colors.gold} />
      </View>

      <Card>
        <View>
          <Text accessibilityRole="header" style={type.sectionTitle}>
            Last 12 weeks
          </Text>
          <Text style={type.meta}>habits done per day</Text>
        </View>
        <Heatmap counts={stats.heatmap} summary={stats.heatmapSummary} />
      </Card>

      <QuestRates rates={stats.habitRates} onEditHabit={onEditHabit} />

      <Card>
        <View style={styles.syncRow}>
          <View style={styles.dot} />
          <Text style={type.bodyStrong}>Saved on this phone</Text>
        </View>
        <Text style={type.secondary}>
          {demo
            ? 'Demo data stays on this phone and is never synced.'
            : 'Playing without an account. Your progress will sync once you sign in.'}
        </Text>
      </Card>

      <Button label="Reset and sign out" variant="danger" onPress={onReset} />
    </ScrollView>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={type.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
  tiles: { flexDirection: 'row', gap: spacing.row },
  tile: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileValue: { ...type.name, fontSize: 24 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
});
