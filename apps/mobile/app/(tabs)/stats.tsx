import { localDate } from '@habit-rpg/game-core';
import { router } from 'expo-router';

import { db } from '@/db/client';
import { getProfile } from '@/db/queries/hero';
import { getSettings } from '@/db/queries/settings';
import { getStats } from '@/db/queries/stats';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { StatsView } from '@/features/stats/stats-view';

function readStats() {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  return getStats(db, LOCAL_USER_ID, localDate(Date.now(), profile.timezone));
}

export default function Stats() {
  const stats = useDbQuery(readStats);
  const demo = useDbQuery(() => getSettings(db).demoMode);
  if (!stats) return null;
  return (
    <StatsView
      stats={stats}
      demo={demo}
      onEditHabit={(id) => router.push({ pathname: '/modal/habit/[id]', params: { id } })}
      onOpenSettings={() => router.push('/modal/settings')}
    />
  );
}
