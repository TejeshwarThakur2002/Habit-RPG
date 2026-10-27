import {
  GearIcon,
  Heatmap,
  IconButton,
  ScreenHeader,
  borders,
  colors,
  radii,
  spacing,
  type,
} from '@habit-rpg/ui';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Stats } from '@/db/queries/stats';
import type { SyncDisplay } from '@/features/sync/sync-display';

import { Card } from './card';
import { QuestRates } from './quest-rates';
import { SyncCard } from './sync-card';

export interface StatsViewProps {
  stats: Stats;
  sync: SyncDisplay;
  /** Opened from the sync pill: scroll down to the sync card. */
  focusSync?: boolean;
  onSyncAction: () => void;
  onEditHabit: (habitId: string) => void;
  onOpenSettings: () => void;
}

/** "Adventure Log" (SCOPE.md section 5.7). */
export function StatsView(props: StatsViewProps) {
  const { stats, sync, focusSync, onSyncAction, onEditHabit, onOpenSettings } = props;
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  // The sync card is last on the screen.
  useEffect(() => {
    if (focusSync) scroll.current?.scrollToEnd({ animated: true });
  }, [focusSync]);
  const month = stats.monthPercent === null ? '–' : `${stats.monthPercent}%`;
  return (
    <ScrollView
      ref={scroll}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <ScreenHeader
        title="Adventure Log"
        right={
          <IconButton label="Settings" onPress={onOpenSettings}>
            <GearIcon />
          </IconButton>
        }
      />
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

      <SyncCard display={sync} onAction={onSyncAction} />
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
});
