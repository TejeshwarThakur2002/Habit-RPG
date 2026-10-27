import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncService } from '@/sync/sync-runner';

// On iOS isInternetReachable is the same as isConnected; on Android it also checks the internet.
const reachable = (state: NetworkState) => state.isInternetReachable ?? state.isConnected ?? false;

/**
 * Starts a sync when SCOPE.md section 8.3 says to: at app start, on return to the foreground,
 * when the network comes back, and 2 s after the last local change (D51). The service decides
 * whether there is anything to do: the demo and a hero kept only on this phone never sync.
 */
export function useSyncTriggers(): void {
  useEffect(() => {
    void syncService.request('start');
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncService.request('foreground');
    });
    // Only a change from offline to online counts as coming back.
    let online: boolean | null = null;
    getNetworkStateAsync()
      .then((state) => {
        online ??= reachable(state);
      })
      .catch((error: unknown) => console.warn('Reading the network state failed', error));
    const network = addNetworkStateListener((state) => {
      const now = reachable(state);
      if (now && online === false) void syncService.request('reconnect');
      online = now;
    });
    // Every synced change writes the outbox in its own transaction (D45).
    const writes = addDatabaseChangeListener((event) => {
      if (event.tableName === 'outbox') syncService.afterWrite();
    });
    return () => {
      app.remove();
      network.remove();
      writes.remove();
    };
  }, []);
}
