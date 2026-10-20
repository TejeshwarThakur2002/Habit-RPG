import { MIN_TOUCH, colors, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Habit } from '@/db/queries/hero';

import { habitMeta } from './habit-meta';

/** Habits not scheduled today, in a group that starts collapsed (SCOPE.md section 5.2). */
export function LaterThisWeek({ habits }: { habits: Habit[] }) {
  const [open, setOpen] = useState(false);
  if (habits.length === 0) return null;

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Later this week, ${habits.length} quests`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.toggle}
      >
        <Text style={type.secondary}>
          {open ? '▾' : '▸'} Later this week ({habits.length})
        </Text>
      </Pressable>
      {open &&
        habits.map((habit) => (
          <View key={habit.id} style={styles.row}>
            <Text style={type.body}>{habit.name}</Text>
            <Text style={type.meta}>{habitMeta(habit)}</Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  toggle: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  row: {
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
});
