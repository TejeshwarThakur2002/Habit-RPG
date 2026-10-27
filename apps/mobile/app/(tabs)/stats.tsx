import { localDate } from '@habit-rpg/game-core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { db } from '@/db/client';
import { getProfile } from '@/db/queries/hero';
import { getStats } from '@/db/queries/stats';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { StatsView } from '@/features/stats/stats-view';
import { syncNow, useSyncDisplay } from '@/features/sync/use-sync-display';

function readStats() {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  return getStats(db, LOCAL_USER_ID, localDate(Date.now(), profile.timezone));
}

export default function Stats() {
  const stats = useDbQuery(readStats);
  const sync = useSyncDisplay();
  // `show=sync` comes from the sync pill; cleared once used, so later visits don't scroll.
  const { show } = useLocalSearchParams<{ show?: string }>();
  useEffect(() => {
    if (show === 'sync') router.setParams({ show: undefined });
  }, [show]);
  if (!stats) return null;
  return (
    <StatsView
      stats={stats}
      sync={sync}
      focusSync={show === 'sync'}
      onSyncAction={syncNow}
      onEditHabit={(id) => router.push({ pathname: '/modal/habit/[id]', params: { id } })}
      onOpenSettings={() => router.push('/modal/settings')}
    />
  );
}
