import { HeroSprite } from '@habit-rpg/sprites';
import { Button, TextField, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

export interface SignInViewProps {
  onTryDemo: () => void;
  /** Plays with a real local hero; it is linked to an account once sign-in exists (D19). */
  onStartLocal: () => void;
}

/**
 * SCOPE.md section 5.8, Sign-in. Email codes need the backend (P3), so until then the email
 * field is shown but "Send code" is disabled with a note (D18). Players can start without an
 * account (D19) or try the demo.
 */
export function SignInView({ onTryDemo, onStartLocal }: SignInViewProps) {
  const [email, setEmail] = useState('');

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
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          hint="Email sign-in arrives with the backend. Start without an account for now."
        />
        <Button label="Send code" disabled />
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
