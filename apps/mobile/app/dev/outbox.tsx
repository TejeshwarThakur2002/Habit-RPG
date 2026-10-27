import { Redirect, router } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { db } from '@/db/client';
import { listOutbox } from '@/db/queries/outbox';
import { getSettings } from '@/db/queries/settings';
import { getSyncState } from '@/db/queries/sync-state';
import { useDbQuery } from '@/db/use-db-query';
import { OutboxView } from '@/features/dev/outbox-view';
import { newId } from '@/lib/device';
import {
  setSimulatedOffline,
  simulatedOffline,
  subscribeSimulatedOffline,
} from '@/sync/offline-switch';
import { syncService } from '@/sync/sync-runner';

function readOutbox() {
  const state = getSyncState(db, newId);
  return {
    rows: listOutbox(db),
    sync: {
      cursor: state.cursor,
      deviceId: state.deviceId,
      account: getSettings(db).accountEmail,
      lastSyncAt: state.lastSyncAt,
    },
  };
}

/** `dev/outbox`, opened from Settings in development builds (D54). */
export default function DevOutbox() {
  const { rows, sync } = useDbQuery(readOutbox);
  const activity = useSyncExternalStore(syncService.subscribe, syncService.activity);
  const offline = useSyncExternalStore(subscribeSimulatedOffline, simulatedOffline);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <OutboxView
      rows={rows}
      sync={sync}
      activity={activity}
      offline={offline}
      onForceSync={() => void syncService.request('manual')}
      onToggleOffline={(on) => {
        setSimulatedOffline(on);
        // Back online: send what piled up, as a reconnect would.
        if (!on) void syncService.request('reconnect');
      }}
      onClose={() => router.back()}
    />
  );
}
