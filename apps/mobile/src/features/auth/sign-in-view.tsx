import { HeroSprite } from '@habit-rpg/sprites';
import { Button, TextField, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';
import { fieldError } from '@/features/onboarding/hero-input';

import { emailSchema } from './auth-input';

export interface SignInViewProps {
  /** Emails a code; resolves with an error message, or null once the code is on its way. */
  onSendCode: (email: string) => Promise<string | null>;
  onTryDemo: () => void;
  /** Plays with a real local hero, which can be linked to an account later (D19). */
  onStartLocal: () => void;
}

/**
 * SCOPE.md section 5.8, Sign-in: email and "Send code" (F1), or play without an account
 * (D19), or try the demo (F11).
 */
export function SignInView({ onSendCode, onTryDemo, onStartLocal }: SignInViewProps) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const parsed = emailSchema.safeParse(email);

  const send = async () => {
    if (!parsed.success) return;
    setSending(true);
    setFailure(null);
    const error = await onSendCode(parsed.data);
    setSending(false);
    setFailure(error);
  };

  return (
    <KeyboardScreen top={56}>
      <View style={styles.hero}>
        <HeroSprite heroClass="knight" cell={10} label="A pixel knight" />
        <Text accessibilityRole="header" style={[type.screenTitle, styles.title]}>
          Habit RPG
        </Text>
        <Text style={[type.secondary, styles.center]}>Turn your habits into an adventure</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email"
          testID="email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setFailure(null);
          }}
          onBlur={() => setTouched(true)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          error={failure ?? (touched ? fieldError(emailSchema, email) : null)}
          hint="We'll email you a 6-digit code. No password needed."
        />
        <Button
          label={sending ? 'Sending…' : 'Send code'}
          disabled={!parsed.success || sending}
          onPress={() => void send()}
        />
        <Button label="Start without an account" variant="secondary" onPress={onStartLocal} />
        <Button label="Try the demo" variant="ghost" onPress={onTryDemo} />
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  title: { fontSize: 28 },
  center: { textAlign: 'center' },
  form: { gap: 12 },
});
