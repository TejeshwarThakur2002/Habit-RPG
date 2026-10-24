import { Button, TextField, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

const CONFIRM_WORD = 'DELETE';

export interface DeleteAccountViewProps {
  email: string | null;
  /** Deletes the account; resolves with an error message, or null once it is gone. */
  onDelete: () => Promise<string | null>;
  onCancel: () => void;
}

/**
 * SCOPE.md F10 and section 5.8: deleting the account removes everything on the server and on
 * this phone, so the button stays off until the player types DELETE.
 */
export function DeleteAccountView({ email, onDelete, onCancel }: DeleteAccountViewProps) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setFailure(null);
    const error = await onDelete();
    setDeleting(false);
    setFailure(error);
  };

  return (
    <KeyboardScreen top={24}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={type.screenTitle}>
          Delete account
        </Text>
        <Text style={type.secondary}>
          This deletes your account{email ? ` (${email})` : ''}, your hero, quests, gold and
          history, from the server and from this phone. It can&apos;t be undone.
        </Text>
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          testID="confirm-delete"
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            setFailure(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          error={failure}
        />
        <Button
          label={deleting ? 'Deleting…' : 'Delete account'}
          variant="danger"
          disabled={typed.trim() !== CONFIRM_WORD || deleting}
          onPress={() => void remove()}
        />
      </View>
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
});
