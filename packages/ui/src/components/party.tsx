// Party screen pieces from SCOPE.md section 5.5: BossCard, MemberRow and BattleLogLine.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borders, colors, fonts, radii, type, type ColorToken } from '../tokens';

/** 1240 -> "1,240" without relying on locale data. */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface BossCardProps {
  name: string;
  hp: number;
  maxHp: number;
  /** The boss sprite (from packages/sprites), already desaturated when defeated. */
  sprite: ReactNode;
  defeated?: boolean;
}

export function BossCard({ name, hp, maxHp, sprite, defeated }: BossCardProps) {
  const fraction = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
  const hpText = `${formatNumber(hp)} / ${formatNumber(maxHp)} HP`;
  return (
    <View style={styles.bossCard}>
      <Text style={styles.bossLabel}>{defeated ? 'Defeated!' : 'Weekly boss'}</Text>
      {sprite}
      <Text accessibilityRole="header" style={type.name}>
        {name}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${name} health`}
        accessibilityValue={{ text: hpText }}
        style={styles.bossTrack}
      >
        <View style={[styles.bossFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View style={styles.bossFooter}>
        <Text style={styles.bossMeta}>{hpText}</Text>
        <Text style={styles.bossMeta}>Every habit you finish = a hit</Text>
      </View>
    </View>
  );
}

export interface MemberRowProps {
  name: string;
  damage: number;
  avatarColor: ColorToken;
  isYou?: boolean;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function MemberRow({ name, damage, avatarColor, isYou }: MemberRowProps) {
  const label = isYou ? `${name} (you)` : name;
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${damage} damage this week`}
      style={styles.member}
    >
      <View style={[styles.avatar, { backgroundColor: colors[avatarColor] }]}>
        <Text style={styles.initials}>{initials(name)}</Text>
      </View>
      <Text style={[type.body, styles.memberName]}>{label}</Text>
      <Text style={styles.damage}>{formatNumber(damage)}</Text>
    </View>
  );
}

export type LogPart = string | { text: string; tone: 'member' | 'boss' };

/** A battle log line: member names in teal, the boss in red, the rest in soft text. */
export function BattleLogLine({ parts }: { parts: readonly LogPart[] }) {
  return (
    <Text style={styles.log}>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Text key={i} style={{ color: part.tone === 'member' ? colors.teal : colors.red }}>
            {part.text}
          </Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  bossCard: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: radii.heroCard,
    borderWidth: borders.card,
    borderColor: colors.bossCardBorder,
    backgroundColor: colors.bossCardBg,
  },
  bossLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.bossLabel,
  },
  bossTrack: {
    alignSelf: 'stretch',
    height: 14,
    borderRadius: 3,
    borderWidth: borders.pill,
    borderColor: colors.bossCardBorder,
    backgroundColor: colors.bossTrack,
    overflow: 'hidden',
  },
  bossFill: { height: '100%', backgroundColor: colors.bossGreen },
  bossFooter: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  bossMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.bossLabel },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.bg },
  memberName: { flex: 1 },
  damage: { ...type.statValue, color: colors.gold },
  log: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
});
