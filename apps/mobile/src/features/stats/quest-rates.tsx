import { Button, Modal, colors, radii, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitRate } from '@/db/queries/stats';

import { Card } from './card';

/** Teal at 70% or more, gold below (SCOPE.md section 5.7, item 4). */
export function rateColor(percent: number | null): string {
  return percent !== null && percent >= 70 ? colors.teal : colors.gold;
}

const percentText = (percent: number | null) => (percent === null ? '–' : `${percent}%`);
const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);

export interface QuestRatesProps {
  rates: HabitRate[];
  onEditHabit: (habitId: string) => void;
}

/** "Quest completion": last-30-day rates; a row opens that quest's streak and an Edit link. */
export function QuestRates({ rates, onEditHabit }: QuestRatesProps) {
  const [open, setOpen] = useState<HabitRate | null>(null);
  return (
    <Card>
      <View>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Quest completion
        </Text>
        <Text style={type.meta}>last 30 days</Text>
      </View>
      {rates.length === 0 && (
        <Text style={type.secondary}>Add a quest to see how it&apos;s going.</Text>
      )}
      {rates.map((rate) => (
        <Pressable
          key={rate.habitId}
          accessibilityRole="button"
          accessibilityLabel={`${rate.name}, ${percentText(rate.percent)} in the last 30 days`}
          accessibilityHint="Shows this quest's streak"
          onPress={() => setOpen(rate)}
          style={styles.row}
        >
          <View style={styles.labels}>
            <Text style={type.body} numberOfLines={1}>
              {rate.name}
            </Text>
            <Text style={type.bodyStrong}>{percentText(rate.percent)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${rate.percent ?? 0}%`, backgroundColor: rateColor(rate.percent) },
              ]}
            />
          </View>
        </Pressable>
      ))}
      <Modal visible={open !== null} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <Text style={[type.body, styles.center]}>
              {`Last 30 days: ${percentText(open.percent)}`}
            </Text>
            <Text style={[type.body, styles.center]}>{`Current streak: ${days(open.streak)}`}</Text>
            <Button
              label="Edit quest"
              variant="secondary"
              onPress={() => {
                setOpen(null);
                onEditHabit(open.habitId);
              }}
            />
            <Button label="Close" variant="ghost" onPress={() => setOpen(null)} />
          </>
        )}
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, minHeight: 44, justifyContent: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.row },
  track: { height: 8, borderRadius: radii.bar, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%' },
  center: { textAlign: 'center' },
});
