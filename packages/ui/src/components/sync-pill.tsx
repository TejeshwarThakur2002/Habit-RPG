import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH, borders, colors, radii, type, type ColorToken } from '../tokens';

/** `local`: nothing to sync yet, for the demo and play without an account (D20). */
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'local';

export interface SyncPillProps {
  status: SyncStatus;
  /** Local changes not yet uploaded; shown when offline. */
  waiting?: number;
  /** Opens the sync card on the Stats tab. */
  onPress?: () => void;
}

const DOT: Record<SyncStatus, ColorToken> = {
  synced: 'teal',
  syncing: 'gold',
  offline: 'gold',
  error: 'red',
  local: 'teal',
};

export function syncPillText(status: SyncStatus, waiting = 0): string {
  switch (status) {
    case 'synced':
      return 'Synced · works offline';
    case 'syncing':
      return 'Syncing...';
    case 'offline':
      return `Offline · ${waiting} waiting`;
    case 'error':
      return 'Sync failed';
    case 'local':
      return 'Saved on this phone';
  }
}

/** SCOPE.md section 5.2 SyncPill: the state is always written out, not only coloured. */
export function SyncPill({ status, waiting, onPress }: SyncPillProps) {
  const text = syncPillText(status, waiting);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint="Shows sync details"
      onPress={onPress}
      hitSlop={(MIN_TOUCH - 28) / 2}
      style={styles.pill}
    >
      <View style={[styles.dot, { backgroundColor: colors[DOT[status]] }]} />
      <Text style={type.meta}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: borders.pill,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: radii.bar },
});
