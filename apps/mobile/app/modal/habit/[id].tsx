import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { db } from '@/db/client';
import { archiveHabit, createHabit, deleteHabit, getHabit, updateHabit } from '@/db/queries/habits';
import { LOCAL_USER_ID } from '@/db/types';
import { NEW_HABIT, formValuesFor } from '@/features/habits/habit-form';
import { HabitSheetView } from '@/features/habits/habit-sheet-view';
import { newId } from '@/lib/device';

/** `modal/habit/new` adds a quest; `modal/habit/<id>` edits one (SCOPE.md section 5.3). */
export default function HabitSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = id === 'new' ? undefined : getHabit(db, LOCAL_USER_ID, id);
  const close = () => router.back();
  const missing = id !== 'new' && !habit;

  // A deleted or unknown habit id (for example from a stale link): just close the sheet.
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);
  if (missing) return null;

  return (
    <HabitSheetView
      editing={habit !== undefined}
      initial={habit ? formValuesFor(habit) : NEW_HABIT}
      onCancel={close}
      onSave={(fields) => {
        const now = Date.now();
        if (habit) updateHabit(db, LOCAL_USER_ID, habit.id, now, fields);
        else createHabit(db, { userId: LOCAL_USER_ID, id: newId(), now, fields });
        close();
      }}
      onArchive={() => {
        if (!habit) return;
        archiveHabit(db, LOCAL_USER_ID, habit.id, Date.now());
        close();
      }}
      onDelete={() => {
        if (!habit) return;
        Alert.alert('Delete this quest?', `"${habit.name}" will be removed from your list.`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteHabit(db, LOCAL_USER_ID, habit.id, Date.now());
              close();
            },
          },
        ]);
      }}
    />
  );
}
