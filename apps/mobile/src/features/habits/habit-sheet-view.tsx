import { baseValues } from '@habit-rpg/game-core';
import { Button, SegmentedControl, TextField, colors, spacing, type } from '@habit-rpg/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HabitFields } from '@/db/queries/habits';

import { habitFormSchema, type HabitFormValues } from './habit-form';
import { CategoryPicker, WeekdayPicker } from './pickers';
import { ReminderPicker, type NotificationPermission } from './reminder-picker';

export interface HabitSheetViewProps {
  initial: HabitFormValues;
  /** Editing shows Archive and Delete. */
  editing: boolean;
  onSave: (fields: HabitFields) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  permission: NotificationPermission;
}

const TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'bad', label: "Don't" },
] as const;

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const;

/** SCOPE.md section 5.8, Habit sheet. */
export function HabitSheetView(props: HabitSheetViewProps) {
  const { control, handleSubmit, formState } = useForm<HabitFormValues, unknown, HabitFields>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: props.initial,
  });
  const [habitType, difficulty] = useWatch({ control, name: ['type', 'difficulty'] });
  const base = baseValues(habitType, difficulty);
  const hpNote = habitType === 'bad' ? 'if broken' : 'if missed';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={type.screenTitle}>
        {props.editing ? 'Edit quest' : 'New quest'}
      </Text>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Name"
            testID="habit-name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={60}
            placeholder="Read 20 pages"
            error={formState.errors.name?.message}
          />
        )}
      />

      <Field label="Type">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              label="Type"
              options={TYPES}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      {habitType === 'weekdays' && (
        <Field label="Days" error={formState.errors.weekdays?.message}>
          <Controller
            control={control}
            name="weekdays"
            render={({ field }) => <WeekdayPicker value={field.value} onChange={field.onChange} />}
          />
        </Field>
      )}

      {habitType !== 'bad' && (
        <Field label="Difficulty">
          <Controller
            control={control}
            name="difficulty"
            render={({ field }) => (
              <SegmentedControl
                label="Difficulty"
                options={DIFFICULTIES}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      )}
      <Text accessibilityLiveRegion="polite" style={type.secondary}>
        +{base.xp} XP · +{base.gold} gold · −{base.hpLoss} HP {hpNote}
      </Text>

      <Field label="Category">
        <Controller
          control={control}
          name="category"
          render={({ field }) => <CategoryPicker value={field.value} onChange={field.onChange} />}
        />
      </Field>

      <Field label="Reminder">
        <Controller
          control={control}
          name="reminderTime"
          render={({ field }) => (
            <ReminderPicker
              value={field.value}
              onChange={field.onChange}
              permission={props.permission}
            />
          )}
        />
      </Field>

      <View style={styles.actions}>
        <Button
          label={props.editing ? 'Save changes' : 'Add quest'}
          onPress={() => void handleSubmit((fields) => props.onSave(fields))()}
        />
        {props.editing && props.onArchive && (
          <Button label="Archive" variant="secondary" onPress={props.onArchive} />
        )}
        {props.editing && props.onDelete && (
          <Button label="Delete" variant="danger" onPress={props.onDelete} />
        )}
        <Button label="Cancel" variant="ghost" onPress={props.onCancel} />
      </View>
    </ScrollView>
  );
}

function Field(props: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={type.secondary}>{props.label}</Text>
      {props.children}
      {props.error && (
        <Text accessibilityLiveRegion="polite" style={[type.meta, styles.error]}>
          {props.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, padding: spacing.screenX, paddingBottom: 48 },
  field: { gap: 6 },
  error: { color: colors.red },
  actions: { gap: 8, paddingTop: 8 },
});
