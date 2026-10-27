import { Button, colors, type, type SyncStatus } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

import type { SyncDisplay } from '@/features/sync/sync-display';

import { Card } from './card';

const DOT: Record<SyncStatus, string> = {
  synced: colors.teal,
  local: colors.teal,
  syncing: colors.gold,
  offline: colors.gold,
  error: colors.red,
};

/** SCOPE.md section 5.7, item 5: the sync status in words, with Retry or Sync now. */
export function SyncCard({ display, onAction }: { display: SyncDisplay; onAction: () => void }) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: DOT[display.pill] }]} />
        <Text accessibilityRole="header" style={type.bodyStrong}>
          {display.title}
        </Text>
      </View>
      <Text style={type.secondary}>{display.detail}</Text>
      {display.action && <Button label={display.action} variant="secondary" onPress={onAction} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
