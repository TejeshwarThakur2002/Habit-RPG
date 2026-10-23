import { Button, TextField } from '@habit-rpg/ui';
import { useState } from 'react';

import { fieldError } from '@/features/onboarding/hero-input';

import { emailSchema } from './auth-input';

export interface EmailFormProps {
  /** Emails a code; resolves with an error message, or null once the code is on its way. */
  onSendCode: (email: string) => Promise<string | null>;
}

/** The email field and "Send code", shared by sign-in and linking an account (D33, D34). */
export function EmailForm({ onSendCode }: EmailFormProps) {
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
    <>
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
    </>
  );
}
