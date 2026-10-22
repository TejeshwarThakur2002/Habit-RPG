import {
  Button,
  MIN_TOUCH,
  ScreenHeader,
  SyncPill,
  borders,
  colors,
  fonts,
  radii,
  spacing,
  type,
} from '@habit-rpg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { QuestBoard } from '@/db/queries/quest-board';

import { BossMiniCard } from './boss-mini-card';
import { HeroCard } from './hero-card';
import { LaterThisWeek } from './later-this-week';
import { TodayList, type LastReward } from './today-list';

export interface QuestBoardViewProps {
  board: QuestBoard;
  onToggle: (habitId: string, done: boolean) => void;
  onOpenParty: () => void;
  /** Opens the habit sheet for a new quest. */
  onAdd: () => void;
  /** Opens the habit sheet for an existing quest (long press or the "Edit" action). */
  onEdit: (habitId: string) => void;
  /** Saves today's quests in a new order (drag handle or "Move up" / "Move down"). */
  onReorder: (habitIds: string[]) => void;
  /** The latest completion's rewards, floated up from its row. */
  lastReward?: LastReward | null;
}

/** The Quests tab (SCOPE.md section 5.4). */
export function QuestBoardView(props: QuestBoardViewProps) {
  const { board, onToggle, onOpenParty, onAdd, onEdit, onReorder, lastReward } = props;
  const insets = useSafeAreaInsets();
  const doneCount = board.today.filter((q) => q.doneToday).length;
  const allDone = board.today.length > 0 && doneCount === board.today.length;
  const noQuests = board.today.length === 0 && board.laterThisWeek.length === 0;

  return (
    <ScrollViewContainer
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <ScreenHeader title="Quest Board" right={<SyncPill status="local" />} />
      <HeroCard board={board} />

      {noQuests ? (
        <View style={styles.empty}>
          <Text style={type.sectionTitle}>No quests yet</Text>
          <Text style={type.secondary}>Add your first one and start earning XP.</Text>
          <Button label="Add a quest" onPress={onAdd} />
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

          <View>
            <TodayList
              quests={board.today}
              onToggle={onToggle}
              onEdit={onEdit}
              onReorder={onReorder}
              lastReward={lastReward ?? null}
            />
            <AddQuestRow onPress={onAdd} />
          </View>
          <LaterThisWeek habits={board.laterThisWeek} />
        </>
      )}

      <BossMiniCard boss={board.boss} onPress={onOpenParty} />
    </ScrollViewContainer>
  );
}

/** The dashed "+ Add a quest" row under the list (SCOPE.md section 5.4, item 5). */
function AddQuestRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a quest"
      onPress={onPress}
      style={styles.addRow}
    >
      <Text style={styles.addText}>+ Add a quest</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addRow: {
    minHeight: Math.max(MIN_TOUCH, 58),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  addText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.row,
    backgroundColor: colors.surfaceNav,
    borderWidth: 2,
    borderColor: colors.teal,
  },
  bannerText: { color: colors.teal },
  empty: { gap: 10, paddingVertical: 8 },
});
