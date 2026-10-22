import { localDate } from '@habit-rpg/game-core';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { db } from '@/db/client';
import { completeHabit, undoCompletion } from '@/db/queries/completions';
import { reorderHabits } from '@/db/queries/habits';
import { getCharacter, getProfile } from '@/db/queries/hero';
import { getQuestBoard } from '@/db/queries/quest-board';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { LevelUpModal, type LevelUp } from '@/features/quests/level-up-modal';
import { QuestBoardView } from '@/features/quests/quest-board-view';
import type { LastReward } from '@/features/quests/today-list';
import { newId } from '@/lib/device';
import { haptics } from '@/lib/haptics';

function readBoard() {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  return getQuestBoard(db, LOCAL_USER_ID, localDate(Date.now(), profile.timezone));
}

export default function Quests() {
  const board = useDbQuery(readBoard);
  const [lastReward, setLastReward] = useState<LastReward | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null);
  // The route guard only opens the tabs once a hero exists, so this is a brief edge case.
  if (!board) return null;

  const toggle = (habitId: string, done: boolean) => {
    const now = Date.now();
    if (done) {
      undoCompletion(db, LOCAL_USER_ID, habitId, now);
      setLastReward(null);
      return;
    }
    const result = completeHabit(db, { userId: LOCAL_USER_ID, habitId, now, newId });
    if (!result) return;
    const { xp, gold } = result.reward;
    haptics.complete();
    setLastReward({ habitId, completionId: result.completionId, xp, gold });
    AccessibilityInfo.announceForAccessibility(`Plus ${xp} XP and ${gold} gold`);
    if (result.levelsGained > 0) {
      haptics.levelUp();
      const level = getCharacter(db, LOCAL_USER_ID)?.level ?? board.level + result.levelsGained;
      setLevelUp({ level, levelsGained: result.levelsGained });
    }
  };

  return (
    <>
      <QuestBoardView
        board={board}
        lastReward={lastReward}
        onToggle={toggle}
        onOpenParty={() => router.navigate('/party')}
        onAdd={() => router.push('/modal/habit/new')}
        onEdit={(habitId) =>
          router.push({ pathname: '/modal/habit/[id]', params: { id: habitId } })
        }
        onReorder={(habitIds) => reorderHabits(db, LOCAL_USER_ID, habitIds, Date.now())}
      />
      <LevelUpModal
        levelUp={levelUp}
        heroClass={board.heroClass}
        equipped={board.equipped}
        onClose={() => setLevelUp(null)}
      />
    </>
  );
}
