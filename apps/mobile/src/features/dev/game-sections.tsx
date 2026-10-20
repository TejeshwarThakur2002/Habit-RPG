import {
  BattleLogLine,
  BossCard,
  HabitRow,
  Heatmap,
  MemberRow,
  ShopItem,
  colors,
  radii,
  type ShopItemState,
} from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GallerySection } from './gallery-section';

// Deterministic sample data: busier in recent weeks, like the design canvas.
const HEAT_COUNTS = Array.from({ length: 84 }, (_, i) => {
  const week = Math.floor(i / 7);
  return ((i * 7 + (i % 5) * 3 + week) % 4) + (week > 6 ? 2 : 0);
});

const SHOP_STATES: { name: string; effect: string; price: number; state: ShopItemState }[] = [
  {
    name: 'Oak Shield',
    effect: '+2 CON · blocks 1 missed daily',
    price: 40,
    state: { kind: 'buyable' },
  },
  {
    name: 'Wizard Hat',
    effect: '+3 INT · 10% more XP from Mind habits',
    price: 75,
    state: { kind: 'expensive', goldNeeded: 12 },
  },
  { name: 'Iron Sword', effect: '+3 STR', price: 60, state: { kind: 'owned' } },
  { name: 'Leather Boots', effect: '+1 STR, +1 CON', price: 50, state: { kind: 'equipped' } },
  {
    name: 'Dragon Cape',
    effect: '+2 STR, +2 LUCK',
    price: 200,
    state: { kind: 'locked', unlockLevel: 10 },
  },
];

/** Placeholder art until packages/sprites lands. */
function Block({ color, size }: { color: string; size: number }) {
  return <View style={[styles.block, { backgroundColor: color, width: size, height: size }]} />;
}

export function GameComponentSections() {
  const [done, setDone] = useState<Record<string, boolean>>({ water: true });
  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <>
      <GallerySection title="HabitRow">
        <HabitRow
          name="Drink 8 glasses of water"
          meta="Daily · Easy"
          rewardXp={10}
          done={!!done.water}
          onToggle={() => toggle('water')}
        />
        <HabitRow
          name="Code for 1 hour"
          meta="Daily · Medium"
          rewardXp={21}
          done={!!done.code}
          onToggle={() => toggle('code')}
        />
        <HabitRow
          name="No doomscrolling after 11pm"
          meta="Bad habit · lose 8 HP if broken"
          rewardXp={5}
          bad
          done={!!done.scroll}
          onToggle={() => toggle('scroll')}
        />
      </GallerySection>

      <GallerySection title="ShopItem">
        {SHOP_STATES.map((item) => (
          <ShopItem key={item.name} {...item} icon={<Block color={colors.purple} size={24} />} />
        ))}
      </GallerySection>

      <GallerySection title="Heatmap">
        <Heatmap counts={HEAT_COUNTS} summary="Sample data: busier in the last 5 weeks" />
      </GallerySection>

      <GallerySection title="BossCard">
        <BossCard
          name="Procrastination Slime"
          hp={1240}
          maxHp={2000}
          sprite={<Block color={colors.bossGreen} size={64} />}
        />
        <BossCard
          name="Snooze Goblin"
          hp={0}
          maxHp={2000}
          defeated
          sprite={<Block color={colors.muted} size={64} />}
        />
      </GallerySection>

      <GallerySection title="MemberRow and BattleLogLine">
        <MemberRow name="Sir Commit" damage={240} avatarColor="purple" isYou />
        <MemberRow name="Mage Ravi" damage={210} avatarColor="teal" />
        <MemberRow name="Archer Nia" damage={185} avatarColor="orange" />
        <MemberRow name="Bard Jay" damage={125} avatarColor="checkboxIdle" />
        <BattleLogLine
          parts={[
            { text: 'Mage Ravi', tone: 'member' },
            ' finished "Read 20 pages" · 20 dmg · 2m ago',
          ]}
        />
        <BattleLogLine
          parts={[{ text: 'The Slime', tone: 'boss' }, ' hit Bard Jay for 8 · missed workout']}
        />
      </GallerySection>
    </>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radii.checkbox },
});
