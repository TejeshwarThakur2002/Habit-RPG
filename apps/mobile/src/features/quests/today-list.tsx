import { DragHandle, FloatingReward, HabitRow, spacing } from '@habit-rpg/ui';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  NestedReorderableList,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import type { QuestBoard } from '@/db/queries/quest-board';

import { habitMeta } from './habit-meta';

type TodayQuest = QuestBoard['today'][number];

export interface LastReward {
  habitId: string;
  /** A new completion restarts the float, even for the same habit. */
  completionId: string;
  xp: number;
  gold: number;
}

export interface TodayListProps {
  quests: TodayQuest[];
  onToggle: (habitId: string, done: boolean) => void;
  onEdit: (habitId: string) => void;
  /** Today's habit ids in their new order. */
  onReorder: (habitIds: string[]) => void;
  lastReward: LastReward | null;
}

/**
 * Today's quests, reordered by dragging a row's handle or with the screen reader's
 * "Move up" / "Move down" (SCOPE.md F2). Lives inside the board's ScrollViewContainer.
 */
export function TodayList(props: TodayListProps) {
  const { quests, onToggle, onEdit, onReorder, lastReward } = props;
  const ids = quests.map((q) => q.habit.id);
  const move = (from: number, to: number) => onReorder(moveItem(ids, from, to));

  return (
    <NestedReorderableList
      data={quests}
      // The board scrolls; this list only grows to fit (and keeps React Native's
      // nested-list check quiet).
      scrollEnabled={false}
      keyExtractor={(q) => q.habit.id}
      onReorder={({ from, to }: ReorderableListReorderEvent) => move(from, to)}
      renderItem={({ item, index }) => (
        <QuestItem
          quest={item}
          onToggle={onToggle}
          onEdit={onEdit}
          reward={lastReward?.habitId === item.habit.id ? lastReward : null}
          onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
          onMoveDown={index < quests.length - 1 ? () => move(index, index + 1) : undefined}
        />
      )}
    />
  );
}

/** A copy of `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

interface QuestItemProps {
  quest: TodayQuest;
  onToggle: (habitId: string, done: boolean) => void;
  onEdit: (habitId: string) => void;
  reward: LastReward | null;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const QuestItem = memo(function QuestItem(props: QuestItemProps) {
  const { habit, rewardXp, doneToday } = props.quest;
  // Only usable inside a reorderable list's cell; starts the drag from the handle.
  const drag = useReorderableDrag();
  return (
    <View style={styles.cell}>
      <HabitRow
        name={habit.name}
        meta={habitMeta(habit)}
        rewardXp={rewardXp}
        done={doneToday}
        bad={habit.type === 'bad'}
        onToggle={() => props.onToggle(habit.id, doneToday)}
        onEdit={() => props.onEdit(habit.id)}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        dragHandle={<DragHandle onPressIn={drag} />}
      />
      {props.reward && (
        <View pointerEvents="none" style={styles.reward}>
          <FloatingReward
            key={props.reward.completionId}
            xp={props.reward.xp}
            gold={props.reward.gold}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  // Spacing inside each cell rather than a separator, so the dragged row carries its gap.
  cell: { paddingBottom: spacing.row },
  // Starts at the row's top edge above its reward, and rises into the gap above the row
  // rather than over the row's own "Done".
  reward: { position: 'absolute', right: 64, top: -10 },
});
