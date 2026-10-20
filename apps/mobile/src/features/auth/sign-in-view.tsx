import { HeroSprite } from '@habit-rpg/sprites';
import { Button, TextField, colors, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SignInViewProps {
  onTryDemo: () => void;
}

/**
 * SCOPE.md section 5.8, Sign-in. Email codes need the backend (P3), so until then the email
 * field is shown but "Send code" is disabled with a note, and the demo is the way in (D18).
 */
export function SignInView({ onTryDemo }: SignInViewProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
    >
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
          hint="Email sign-in arrives with the backend. Try the demo for now."
        />
        <Button label="Send code" disabled />
        <Button label="Try the demo" variant="ghost" onPress={onTryDemo} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    backgroundColor: colors.bg,
  },
  hero: { alignItems: 'center', gap: 12 },
  title: { fontSize: 28 },
  center: { textAlign: 'center' },
  form: { gap: 12 },
});
