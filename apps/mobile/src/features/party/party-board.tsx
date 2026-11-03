import { BOSS_NAMES } from '@habit-rpg/game-core';
import { BossSprite } from '@habit-rpg/sprites';
import { BattleLogLine, BossCard, borders, colors, radii, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

import type { PartyView } from '@/db/queries/party';
import { Card } from '@/features/stats/card';

import type { LogLine } from './party-text';

/** SCOPE.md section 5.5, item 2: this week's boss; 12 pt cells give the 144 x 96 sprite. */
export function BossFight({ boss }: { boss: NonNullable<PartyView['boss']> }) {
  return (
    <BossCard
      name={BOSS_NAMES[boss.bossKey]}
      hp={boss.currentHp}
      maxHp={boss.maxHp}
      defeated={boss.defeated}
      sprite={<BossSprite boss={boss.bossKey} cell={12} defeated={boss.defeated} />}
    />
  );
}

/** Item 4: the latest 20 events, newest first. */
export function BattleLog({ lines }: { lines: LogLine[] }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={type.sectionTitle}>
        Battle log
      </Text>
      {lines.length === 0 ? (
        <Text style={type.secondary}>No hits yet. Finish a quest to strike first.</Text>
      ) : (
        lines.map((line) => <BattleLogLine key={line.id} parts={line.parts} />)
      )}
    </Card>
  );
}

/** "Offline or stale": the tab is showing what it last stored. */
export function StaleBanner({ text }: { text: string }) {
  return (
    <View accessible accessibilityRole="alert" style={styles.banner}>
      <Text style={type.meta}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.row,
    borderWidth: borders.pill,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
