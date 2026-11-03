import { BOSS_NAMES } from '@habit-rpg/game-core';
import { BossSprite } from '@habit-rpg/sprites';
import { BattleLogLine, BossCard, Button, borders, colors, radii, type } from '@habit-rpg/ui';
import { useState } from 'react';
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

/**
 * Under a defeated boss (SCOPE.md section 5.5, states): "Claim reward" once, then the countdown
 * to Monday's boss. The demo only counts down.
 */
export function Victory(props: {
  claimed: boolean;
  readOnly: boolean;
  countdown: string;
  /** Resolves with an error message, or null once the reward is claimed. */
  onClaim: () => Promise<string | null>;
}) {
  const { claimed, readOnly, countdown, onClaim } = props;
  const [claiming, setClaiming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (claimed || readOnly) {
    return (
      <Text accessibilityLiveRegion="polite" style={[type.secondary, styles.centred]}>
        {claimed ? `Reward claimed. ${countdown}` : countdown}
      </Text>
    );
  }
  const claim = async () => {
    setClaiming(true);
    setFailure(await onClaim());
    setClaiming(false);
  };
  return (
    <View style={styles.claim}>
      <Button
        label={claiming ? 'Claiming…' : 'Claim reward: 50 gold'}
        disabled={claiming}
        onPress={() => void claim()}
      />
      {failure && (
        <Text accessibilityLiveRegion="polite" style={[type.meta, styles.failure]}>
          {failure}
        </Text>
      )}
    </View>
  );
}

/** Item 5: the invite code with Copy and Share. */
export function InviteCard(props: { code: string; onCopy: () => void; onShare: () => void }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={type.sectionTitle}>
        Invite friends
      </Text>
      <Text accessibilityLabel={`Invite code ${props.code.split('').join(' ')}`} style={type.body}>
        Invite code: <Text style={styles.code}>{props.code}</Text>
      </Text>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Button label="Copy" variant="secondary" onPress={props.onCopy} />
        </View>
        <View style={styles.grow}>
          <Button label="Share" variant="secondary" onPress={props.onShare} />
        </View>
      </View>
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
  centred: { textAlign: 'center' },
  claim: { gap: 8 },
  failure: { color: colors.red, textAlign: 'center' },
  code: { ...type.name, color: colors.gold, letterSpacing: 2 },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.row,
    borderWidth: borders.pill,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
