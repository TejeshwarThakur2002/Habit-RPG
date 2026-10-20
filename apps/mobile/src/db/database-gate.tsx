import { colors, type } from '@habit-rpg/ui';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { db } from './client';
import migrations from './migrations/migrations';

/**
 * Runs pending migrations before any screen reads the database. Migrations are local and
 * fast, so nothing is shown while they run (SCOPE.md section 5.4, "Loading").
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Could not open your data
        </Text>
        <Text style={type.secondary}>
          {__DEV__ ? error.message : 'Please restart the app. Your data has not been changed.'}
        </Text>
      </View>
    );
  }
  if (!success) return null;
  return children;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: colors.bg,
  },
});
