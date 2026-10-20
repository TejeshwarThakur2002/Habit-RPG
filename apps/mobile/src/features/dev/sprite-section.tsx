import { BOSS_ROSTER, type GearId } from '@habit-rpg/game-core';
import { BossSprite, HeroSprite } from '@habit-rpg/sprites';
import { colors, radii, type } from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GallerySection } from './gallery-section';

const OUTFITS: { label: string; gear: GearId[] }[] = [
  { label: 'No gear', gear: [] },
  { label: 'Sword + shield', gear: ['iron-sword', 'oak-shield'] },
  { label: 'Hat + charm', gear: ['wizard-hat', 'lucky-clover-charm'] },
  { label: 'Cape + boots', gear: ['dragon-cape', 'leather-boots'] },
];

function Tile({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <View style={styles.tile}>
      {children}
      <Text style={type.meta}>{caption}</Text>
    </View>
  );
}

export function SpriteSection() {
  return (
    <>
      <GallerySection title="HeroSprite">
        <View style={styles.grid}>
          {(['knight', 'mage', 'rogue'] as const).map((heroClass) => (
            <Tile key={heroClass} caption={heroClass}>
              <HeroSprite heroClass={heroClass} cell={8} />
            </Tile>
          ))}
        </View>
        <View style={styles.grid}>
          {OUTFITS.map(({ label, gear }) => (
            <Tile key={label} caption={label}>
              <HeroSprite heroClass="knight" equipped={gear} cell={6} />
            </Tile>
          ))}
        </View>
      </GallerySection>

      <GallerySection title="BossSprite">
        <View style={styles.grid}>
          {BOSS_ROSTER.map((boss) => (
            <Tile key={boss} caption={boss}>
              <BossSprite boss={boss} cell={6} />
            </Tile>
          ))}
          <Tile caption="defeated">
            <BossSprite boss="procrastination-slime" cell={6} defeated />
          </Tile>
        </View>
      </GallerySection>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    padding: 8,
    borderRadius: radii.row,
    backgroundColor: colors.surface2,
  },
});
