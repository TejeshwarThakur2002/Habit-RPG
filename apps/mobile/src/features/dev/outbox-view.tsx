import { Button, colors, radii, spacing, type } from '@habit-rpg/ui';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SyncActivity } from '@/sync/sync-service';

export interface OutboxRow {
  id: number;
  tableName: string;
  op: string;
  rowId: string;
  attempts: number;
  lastError: string | null;
}

export interface OutboxViewProps {
  rows: OutboxRow[];
  sync: { cursor: number; deviceId: string; account: string | null; lastSyncAt: string | null };
  activity: SyncActivity;
  offline: boolean;
  onForceSync: () => void;
  onToggleOffline: (on: boolean) => void;
  onClose: () => void;
}

const short = (id: string) => id.slice(0, 8);

/** Development builds only (D54): what waits to sync, and switches to see it at work. */
export function OutboxView(props: OutboxViewProps) {
  const { rows, sync, activity, offline } = props;
  const insets = useSafeAreaInsets();
  const state = activity.message ? `${activity.state}: ${activity.message}` : activity.state;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text accessibilityRole="header" style={type.screenTitle}>
        Sync outbox
      </Text>
      <View style={styles.box}>
        <Text style={type.body}>Sync: {state}</Text>
        <Text style={type.secondary}>Account: {sync.account ?? 'none'}</Text>
        <Text style={type.secondary}>Cursor: {sync.cursor}</Text>
        <Text style={type.secondary}>Device: {short(sync.deviceId)}</Text>
        <Text style={type.secondary}>Last sync: {sync.lastSyncAt ?? 'never'}</Text>
      </View>
      <View style={styles.row}>
        <Text style={type.body}>Simulate offline</Text>
        <Switch
          accessibilityLabel="Simulate offline"
          value={offline}
          onValueChange={props.onToggleOffline}
          trackColor={{ true: colors.gold, false: colors.borderStrong }}
        />
      </View>
      <Button label="Force sync" onPress={props.onForceSync} />

      <Text accessibilityRole="header" style={type.sectionTitle}>
        {rows.length === 1 ? '1 change waiting' : `${rows.length} changes waiting`}
      </Text>
      {rows.map((row) => (
        <View key={row.id} accessible style={styles.box}>
          <Text style={type.bodyStrong}>
            #{row.id} {row.tableName} {row.op} {short(row.rowId)}
          </Text>
          <Text style={type.secondary}>
            Tried {row.attempts} {row.attempts === 1 ? 'time' : 'times'}
            {row.lastError ? ` · ${row.lastError}` : ''}
          </Text>
        </View>
      ))}
      <Button label="Close" variant="ghost" onPress={props.onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, padding: spacing.screenX, paddingBottom: 48 },
  box: {
    gap: 4,
    padding: spacing.cardPadding,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
