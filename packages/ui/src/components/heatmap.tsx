import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../tokens';

export const HEATMAP_WEEKS = 12;
const CELL = 22;
const GAP = 4;

/** Colour level for a day's completion count: 0, 1, 2, 3-4, 5+ (SCOPE.md section 5.2). */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return count >= 1 ? 1 : 0;
}

export interface HeatmapProps {
  /**
   * Completions per day for the last 12 weeks, oldest first, one week (Monday to Sunday) after
   * another: `counts[week * 7 + day]`. Missing days count as 0.
   */
  counts: readonly number[];
  /** One sentence for screen readers, e.g. "7 of the last 12 weeks had 5 or more active days". */
  summary: string;
}

/** 12 week-columns by 7 day-rows (Monday on top), with a Less/More legend. */
export function Heatmap({ counts, summary }: HeatmapProps) {
  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => heatLevel(counts[week * 7 + day] ?? 0)),
  );

  return (
    <View style={styles.root}>
      <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.grid}>
        {weeks.map((days, week) => (
          <View key={week} style={styles.column}>
            {days.map((level, day) => (
              <View key={day} style={[styles.cell, { backgroundColor: colors.heat[level] }]} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <Text style={type.label}>Less</Text>
        {colors.heat.map((color) => (
          <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
        ))}
        <Text style={type.label}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  grid: { flexDirection: 'row', gap: GAP, alignSelf: 'center' },
  column: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
});
