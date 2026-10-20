import {
  BottomSheet,
  Button,
  Modal,
  SegmentedControl,
  TextField,
  Toast,
  type,
} from '@habit-rpg/ui';
import { useState } from 'react';
import { Text } from 'react-native';

import { GallerySection } from './gallery-section';

const HABIT_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'bad', label: "Don't" },
] as const;
type HabitTypeValue = (typeof HABIT_TYPES)[number]['value'];

export function OverlaySections() {
  const [name, setName] = useState('S');
  const [habitType, setHabitType] = useState<HabitTypeValue>('daily');
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const nameError = name.trim().length < 2 ? 'Use 2 to 20 characters' : null;

  return (
    <>
      <GallerySection title="TextField and SegmentedControl">
        <TextField
          label="Hero name"
          value={name}
          onChangeText={setName}
          maxLength={20}
          hint="2 to 20 characters"
          error={nameError}
        />
        <SegmentedControl
          label="Habit type"
          options={HABIT_TYPES}
          value={habitType}
          onChange={setHabitType}
        />
      </GallerySection>

      <GallerySection title="Modal, BottomSheet and Toast">
        <Button label="Open modal" variant="secondary" onPress={() => setModal(true)} />
        <Button label="Open bottom sheet" variant="secondary" onPress={() => setSheet(true)} />
        <Button
          label="Show toast"
          variant="secondary"
          onPress={() => setToast(`Bought Oak Shield (${Date.now() % 1000})`)}
        />
        {toast && (
          <Toast
            message={toast}
            action={{ label: 'Undo', onPress: () => setToast(null) }}
            onDismiss={() => setToast(null)}
          />
        )}
      </GallerySection>

      <Modal visible={modal} title="Level 8!" onClose={() => setModal(false)}>
        <Text style={[type.secondary, { textAlign: 'center' }]}>HP restored, +25 gold</Text>
        <Button label="Continue" onPress={() => setModal(false)} />
      </Modal>

      <BottomSheet visible={sheet} title="New quest" onClose={() => setSheet(false)}>
        <TextField label="Name" value="Read 20 pages" maxLength={60} />
        <SegmentedControl
          label="Habit type"
          options={HABIT_TYPES}
          value={habitType}
          onChange={setHabitType}
        />
        <Button label="Save" onPress={() => setSheet(false)} />
      </BottomSheet>
    </>
  );
}
