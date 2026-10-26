import { Toast, spacing } from '@habit-rpg/ui';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentNotice, dismissNotice, subscribeNotices } from '@/sync/notices';

/**
 * Shows sync notices (a refused purchase, a duplicate quest) one at a time over every screen,
 * above the tab bar. Each stays for the toast's usual 5 seconds (D47).
 */
export function SyncNotices() {
  const message = useSyncExternalStore(subscribeNotices, currentNotice);
  const insets = useSafeAreaInsets();
  if (message === null) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <Toast key={message} message={message} tone="error" onDismiss={dismissNotice} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.screenX, right: spacing.screenX },
});
