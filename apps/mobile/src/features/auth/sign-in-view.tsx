import { HeroSprite } from '@habit-rpg/sprites';
import { Button, type } from '@habit-rpg/ui';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

import { EmailForm } from './email-form';

export interface SignInViewProps {
  /** Emails a code; resolves with an error message, or null once the code is on its way. */
  onSendCode: (email: string) => Promise<string | null>;
  onTryDemo: () => void;
  /** Plays with a real local hero, which can be linked to an account later (D19, D34). */
  onStartLocal: () => void;
}

/**
 * SCOPE.md section 5.8, Sign-in: email and "Send code" (F1), or play without an account
 * (D19), or try the demo (F11).
 */
export function SignInView({ onSendCode, onTryDemo, onStartLocal }: SignInViewProps) {
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
        <EmailForm onSendCode={onSendCode} />
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
