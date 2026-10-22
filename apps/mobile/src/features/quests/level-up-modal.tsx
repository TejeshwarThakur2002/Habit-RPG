import type { GearId, HeroClass } from '@habit-rpg/game-core';
import { LEVEL_UP_GOLD } from '@habit-rpg/game-core';
import { HeroSprite } from '@habit-rpg/sprites';
import { Button, Confetti, Hop, Modal, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

export interface LevelUp {
  level: number;
  /** One completion can cross more than one level. */
  levelsGained: number;
}

/** "HP restored, +25 gold" (SCOPE.md section 5.8), times each level gained. */
export function levelUpReward(levelsGained: number): string {
  return `HP restored, +${LEVEL_UP_GOLD * levelsGained} gold`;
}

export interface LevelUpModalProps {
  levelUp: LevelUp | null;
  heroClass: HeroClass;
  equipped: readonly GearId[];
  onClose: () => void;
}

/** The level-up celebration (SCOPE.md F3): the hero hops and pixel confetti falls. */
export function LevelUpModal({ levelUp, heroClass, equipped, onClose }: LevelUpModalProps) {
  return (
    <Modal visible={levelUp !== null} title={`Level ${levelUp?.level ?? ''}!`} onClose={onClose}>
      {levelUp && (
        <>
          <View style={styles.hero}>
            <Confetti />
            <Hop>
              <HeroSprite heroClass={heroClass} equipped={equipped} cell={8} />
            </Hop>
          </View>
          <Text style={[type.body, styles.center]}>{levelUpReward(levelUp.levelsGained)}</Text>
          <Button label="Continue" onPress={onClose} />
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 8 },
  center: { textAlign: 'center' },
});
