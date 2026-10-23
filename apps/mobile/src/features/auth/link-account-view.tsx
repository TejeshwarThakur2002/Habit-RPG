import { Button, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

import { EmailForm } from './email-form';
import { VerifyView } from './verify-view';

export interface LinkAccountViewProps {
  heroName: string;
  /** Emails a code; resolves with an error message, or null once it is on its way. */
  onSendCode: (email: string) => Promise<string | null>;
  /** Checks the code and links the account; resolves with an error message, or null. */
  onVerify: (email: string, code: string) => Promise<string | null>;
  onCancel: () => void;
}

/**
 * Signs a local hero in without starting over (owner's choice, D34): the same email and code
 * steps as sign-in, opened from Settings. The hero and its history stay on the phone.
 */
export function LinkAccountView({
  heroName,
  onSendCode,
  onVerify,
  onCancel,
}: LinkAccountViewProps) {
  const [email, setEmail] = useState<string | null>(null);

  if (email !== null) {
    return (
      <VerifyView
        email={email}
        onVerify={(code) => onVerify(email, code)}
        onResend={() => onSendCode(email)}
        onBack={() => setEmail(null)}
      />
    );
  }

  return (
    <KeyboardScreen top={24}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={type.screenTitle}>
          Link an account
        </Text>
        <Text style={type.secondary}>
          Sign in with your email to keep {heroName} on your account. Your quests and progress stay
          exactly as they are.
        </Text>
        <EmailForm
          onSendCode={async (value) => {
            const error = await onSendCode(value);
            if (error === null) setEmail(value);
            return error;
          }}
        />
      </View>
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
});
