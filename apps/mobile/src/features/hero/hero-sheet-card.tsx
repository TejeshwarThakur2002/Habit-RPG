import type { StatName } from '@habit-rpg/game-core';
import { HeroSprite } from '@habit-rpg/sprites';
import { StatChip, borders, colors, radii, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HeroSheet } from '@/db/queries/gear';

import { STAT_HELP } from './gear-text';

const STATS: StatName[] = ['STR', 'INT', 'CON', 'LUCK'];
const CLASS_TITLES = { knight: 'Knight', mage: 'Mage', rogue: 'Rogue' } as const;

/** SCOPE.md section 5.6, item 2: sprite with gear, name, level and class, and the four stats. */
export function HeroSheetCard({ sheet }: { sheet: HeroSheet }) {
  const [openStat, setOpenStat] = useState<StatName | null>(null);
  const equipped = sheet.inventory.filter((r) => r.equipped).map((r) => r.itemId);
  const title = `Level ${sheet.level} ${CLASS_TITLES[sheet.heroClass]}`;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.tile}>
          {/* 11 pt cells draw the 10 x 12 sprite at 110 x 132, as the design asks. */}
          <HeroSprite
            heroClass={sheet.heroClass}
            equipped={equipped}
            cell={11}
            label={`${sheet.heroName}, ${title}`}
          />
        </View>
        <View style={styles.info}>
          <Text style={type.name} numberOfLines={1}>
            {sheet.heroName}
          </Text>
          <Text style={type.meta}>{title}</Text>
          <View style={styles.grid}>
            {STATS.map((stat) => (
              <View key={stat} style={styles.cell}>
                <StatChip
                  label={stat}
                  value={sheet.stats[stat]}
                  onPress={() => setOpenStat((open) => (open === stat ? null : stat))}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
      {openStat && (
        <Text accessibilityLiveRegion="polite" style={[type.secondary, styles.tip]}>
          {STAT_HELP[openStat]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 18,
    borderRadius: radii.heroCard,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', gap: 14 },
  tile: {
    width: 136,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.surface2,
  },
  info: { flex: 1, minWidth: 0, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.row, marginTop: 6 },
  cell: { width: '47%' },
  tip: {
    padding: 10,
    borderRadius: radii.row,
    backgroundColor: colors.surface2,
    color: colors.text,
  },
});
