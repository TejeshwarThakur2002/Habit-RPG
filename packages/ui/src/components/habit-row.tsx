import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { borders, colors, radii, type } from '../tokens';

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
  const { name, meta, rewardXp, done, bad, onToggle, onEdit } = props;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={habitRowLabel(props)}
      accessibilityState={{ checked: done }}
      accessibilityActions={onEdit ? [{ name: 'activate' }, { name: 'edit', label: 'Edit' }] : []}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'edit' ? onEdit?.() : onToggle())}
      onPress={onToggle}
      onLongPress={onEdit}
      style={[styles.row, done && styles.rowDone, bad && styles.rowBad]}
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
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowDone: { backgroundColor: colors.surfaceNav },
  rowBad: { borderColor: colors.badHabitBorder },
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
