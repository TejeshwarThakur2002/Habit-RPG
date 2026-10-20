import { localDate } from '@habit-rpg/game-core';
import { router } from 'expo-router';

import { db } from '@/db/client';
import { completeHabit, undoCompletion } from '@/db/queries/completions';
import { getProfile } from '@/db/queries/hero';
import { getQuestBoard } from '@/db/queries/quest-board';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { QuestBoardView } from '@/features/quests/quest-board-view';
import { newId } from '@/lib/device';

function readBoard() {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  return getQuestBoard(db, LOCAL_USER_ID, localDate(Date.now(), profile.timezone));
}

export default function Quests() {
  const board = useDbQuery(readBoard);
  // The route guard only opens the tabs once a hero exists, so this is a brief edge case.
  if (!board) return null;

  const toggle = (habitId: string, done: boolean) => {
    const now = Date.now();
    if (done) undoCompletion(db, LOCAL_USER_ID, habitId, now);
    else completeHabit(db, { userId: LOCAL_USER_ID, habitId, now, newId });
  };

  return (
    <QuestBoardView board={board} onToggle={toggle} onOpenParty={() => router.navigate('/party')} />
  );
}
