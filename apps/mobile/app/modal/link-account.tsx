import { router } from 'expo-router';

import { db } from '@/db/client';
import { getProfile } from '@/db/queries/hero';
import { recordSignIn } from '@/db/queries/local-data';
import { LOCAL_USER_ID } from '@/db/types';
import { LinkAccountView } from '@/features/auth/link-account-view';
import { sendCode, verifyCode } from '@/lib/supabase';

/** `modal/link-account`, opened from Settings for a hero made without an account (D34). */
export default function LinkAccount() {
  const heroName = getProfile(db, LOCAL_USER_ID)?.heroName ?? 'your hero';
  return (
    <LinkAccountView
      heroName={heroName}
      onSendCode={async (email) => {
        const result = await sendCode(email);
        return result.ok ? null : result.message;
      }}
      onVerify={async (email, code) => {
        const result = await verifyCode(email, code);
        if (!result.ok) return result.message;
        // Only the account is recorded: the hero, quests and history are left untouched.
        recordSignIn(db, result.value);
        router.back();
        return null;
      }}
      onCancel={() => router.back()}
    />
  );
}
