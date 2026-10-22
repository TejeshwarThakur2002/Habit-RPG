import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { MIN_TOUCH, borders, colors, radii, type } from '../tokens';

export interface HabitRowProps {
  name: string;
  /** e.g. "Daily · Medium" or "Bad habit · lose 8 HP if broken". */
  meta: string;
  /** The XP this completion would actually give, from game-core. */
  rewardXp: number;
  done: boolean;
  /** A "don't" quest: red border and reward. */
  bad?: boolean;
  onToggle: () => void;
  /** Long press, or the screen reader "Edit" action, opens the habit sheet. */
  onEdit?: () => void;
  /** A `DragHandle` at the right edge, for lists that can be reordered. */
  dragHandle?: ReactNode;
  /** Screen reader "Move up" / "Move down" actions, the accessible way to reorder. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// A chunky pixel check on a 7 x 7 grid of 2-unit cells. Whole-unit cells keep it sharp,
// since react-native-svg has no shapeRendering prop (DECISIONS.md D14).
const CHECK_PIXELS: readonly (readonly [number, number])[] = [
  [6, 1],
  [5, 2],
  [6, 2],
  [0, 3],
  [4, 3],
  [5, 3],
  [0, 4],
  [1, 4],
  [3, 4],
  [4, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [2, 6],
];

/** Reads like "Code for 1 hour, daily, medium, plus 20 XP, not done" (SCOPE.md section 5.10). */
export function habitRowLabel(props: Pick<HabitRowProps, 'name' | 'meta' | 'rewardXp' | 'done'>) {
  const meta = props.meta.split(' · ').join(', ').toLowerCase();
  return `${props.name}, ${meta}, plus ${props.rewardXp} XP, ${props.done ? 'done' : 'not done'}`;
}

/** SCOPE.md section 5.2 HabitRow: todo, done and bad-habit states, at least 58 tall. */
export const HabitRow = memo(function HabitRow(props: HabitRowProps) {
  const { name, meta, rewardXp, done, bad, onToggle, onEdit, dragHandle } = props;
  const actions = rowActions(props);
  return (
    <View style={[styles.row, done && styles.rowDone, bad && styles.rowBad]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={habitRowLabel(props)}
        accessibilityState={{ checked: done }}
        accessibilityActions={actions.length > 0 ? [{ name: 'activate' }, ...actions] : []}
        onAccessibilityAction={(e) => {
          const handler = actions.find((a) => a.name === e.nativeEvent.actionName)?.run;
          (handler ?? onToggle)();
        }}
        onPress={onToggle}
        onLongPress={onEdit}
        style={[styles.press, dragHandle !== undefined && styles.pressWithHandle]}
      >
        <View style={[styles.box, done && styles.boxDone]}>
          {done && (
            <Svg width={14} height={14} viewBox="0 0 14 14">
              {CHECK_PIXELS.map(([x, y]) => (
                <Rect key={`${x}-${y}`} x={x * 2} y={y * 2} width={2} height={2} fill={colors.bg} />
              ))}
            </Svg>
          )}
        </View>
        <View style={styles.text}>
          <Text style={[type.bodyStrong, done && styles.nameDone]}>{name}</Text>
          <Text style={type.meta}>{meta}</Text>
        </View>
        <Text style={[type.reward, { color: done ? colors.teal : bad ? colors.red : colors.gold }]}>
          {done ? 'Done' : `+${rewardXp} XP`}
        </Text>
      </Pressable>
      {dragHandle}
    </View>
  );
});

function rowActions(props: HabitRowProps) {
  const all = [
    { name: 'edit', label: 'Edit', run: props.onEdit },
    { name: 'moveUp', label: 'Move up', run: props.onMoveUp },
    { name: 'moveDown', label: 'Move down', run: props.onMoveDown },
  ];
  return all.filter((a): a is typeof a & { run: () => void } => a.run !== undefined);
}

/**
 * Three pixel bars to press and drag. Screen readers skip it: they can't drag, and the row
 * offers "Move up" and "Move down" instead.
 */
export function DragHandle({ onPressIn }: { onPressIn: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Drag to reorder"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      hitSlop={6}
      onPressIn={onPressIn}
      style={styles.handle}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.handleBar} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowDone: { backgroundColor: colors.surfaceNav },
  rowBad: { borderColor: colors.badHabitBorder },
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pressWithHandle: { paddingRight: 4 },
  handle: {
    width: MIN_TOUCH,
    alignSelf: 'stretch',
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginRight: 4,
  },
  handleBar: { width: 16, height: 3, backgroundColor: colors.muted },
  box: {
    width: 26,
    height: 26,
    borderRadius: radii.checkbox,
    borderWidth: borders.card,
    borderColor: colors.checkboxIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { borderColor: colors.gold, backgroundColor: colors.gold },
  text: { flex: 1, minWidth: 0, gap: 2 },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
});
