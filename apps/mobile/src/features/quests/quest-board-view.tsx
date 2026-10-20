import { HabitRow, ScreenHeader, SyncPill, colors, radii, spacing, type } from '@habit-rpg/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { QuestBoard } from '@/db/queries/quest-board';

import { BossMiniCard } from './boss-mini-card';
import { habitMeta } from './habit-meta';
import { HeroCard } from './hero-card';
import { LaterThisWeek } from './later-this-week';

export interface QuestBoardViewProps {
  board: QuestBoard;
  onToggle: (habitId: string, done: boolean) => void;
  onOpenParty: () => void;
}

/** The Quests tab (SCOPE.md section 5.4). */
export function QuestBoardView({ board, onToggle, onOpenParty }: QuestBoardViewProps) {
  const insets = useSafeAreaInsets();
  const doneCount = board.today.filter((q) => q.doneToday).length;
  const allDone = board.today.length > 0 && doneCount === board.today.length;
  const noQuests = board.today.length === 0 && board.laterThisWeek.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <ScreenHeader title="Quest Board" right={<SyncPill status="local" />} />
      <HeroCard board={board} />

      {noQuests ? (
        <View style={styles.empty}>
          <Text style={type.sectionTitle}>No quests yet</Text>
          <Text style={type.secondary}>Add your first one and start earning XP.</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionRow}>
            <Text accessibilityRole="header" style={type.sectionTitle}>
              Today&apos;s quests
            </Text>
            <Text style={type.secondary}>
              {doneCount} of {board.today.length} done
            </Text>
          </View>

          {allDone && (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text style={[type.bodyStrong, styles.bannerText]}>
                All quests done! See you tomorrow.
              </Text>
            </View>
          )}

          <View style={styles.list}>
            {board.today.map(({ habit, rewardXp, doneToday }) => (
              <HabitRow
                key={habit.id}
                name={habit.name}
                meta={habitMeta(habit)}
                rewardXp={rewardXp}
                done={doneToday}
                bad={habit.type === 'bad'}
                onToggle={() => onToggle(habit.id, doneToday)}
              />
            ))}
          </View>
          <LaterThisWeek habits={board.laterThisWeek} />
        </>
      )}

      <BossMiniCard boss={board.boss} onPress={onOpenParty} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  list: { gap: spacing.row },
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.row,
    backgroundColor: colors.surfaceNav,
    borderWidth: 2,
    borderColor: colors.teal,
  },
  bannerText: { color: colors.teal },
  empty: { gap: 6, paddingVertical: 8 },
});
