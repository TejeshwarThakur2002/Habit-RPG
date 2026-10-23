import { Button, TextField, type } from '@habit-rpg/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

import { CODE_LENGTH, RESEND_SECONDS, codeSchema } from './auth-input';

export interface VerifyViewProps {
  email: string;
  /** Checks the code; resolves with an error message, or null once signed in. */
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onBack: () => void;
}

/** SCOPE.md section 5.8, Verify: the 6-digit code submits itself; "Resend in 30 s". */
export function VerifyView({ email, onVerify, onResend, onBack }: VerifyViewProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const waitLeft = useCountdown();

  const check = async (value: string) => {
    if (!codeSchema.safeParse(value).success) return;
    setChecking(true);
    const error = await onVerify(value);
    setChecking(false);
    setFailure(error);
  };

  const change = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setFailure(null);
    if (digits.length === CODE_LENGTH) void check(digits);
  };

  const resend = async () => {
    waitLeft.restart();
    setFailure(null);
    const error = await onResend();
    setNotice(error ? null : `A new code is on its way to ${email}.`);
    setFailure(error);
  };

  return (
    <KeyboardScreen top={56}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={type.screenTitle}>
          Check your email
        </Text>
        <Text style={type.secondary}>We sent a 6-digit code to {email}.</Text>
        <TextField
          label="Code"
          testID="code"
          value={code}
          onChangeText={change}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          editable={!checking}
          error={failure}
          hint={checking ? 'Checking…' : (notice ?? undefined)}
        />
      </View>
      <View style={styles.actions}>
        <Button
          label={waitLeft.seconds > 0 ? `Resend in ${waitLeft.seconds} s` : 'Resend code'}
          variant="secondary"
          disabled={waitLeft.seconds > 0 || checking}
          onPress={() => void resend()}
        />
        <Button label="Use a different email" variant="ghost" onPress={onBack} />
      </View>
    </KeyboardScreen>
  );
}

/** Seconds until another code may be asked for, counting down once a second. */
function useCountdown() {
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return { seconds, restart: () => setSeconds(RESEND_SECONDS) };
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  actions: { gap: 8 },
});
