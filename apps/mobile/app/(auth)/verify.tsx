import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { db } from '@/db/client';
import { recordSignIn } from '@/db/queries/local-data';
import { emailSchema } from '@/features/auth/auth-input';
import { VerifyView } from '@/features/auth/verify-view';
import { sendCode, verifyCode } from '@/lib/supabase';
import { firstSyncNow } from '@/sync/first-sync-runner';

/** `(auth)/verify` (SCOPE.md section 5.3): the code from the email. */
export default function Verify() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = emailSchema.safeParse(params.email);

  // Opened without a valid email (a stale link, or the router landing here after sign-out):
  // there may be nothing to go back to, so replace this screen with sign-in.
  if (!email.success) return <Redirect href="/sign-in" />;

  return (
    <VerifyView
      email={email.data}
      onVerify={async (code) => {
        const result = await verifyCode(email.data, code);
        if (!result.ok) return result.message;
        // An account that already has a hero brings it down first, so onboarding is skipped
        // (D48). Offline, onboarding runs and the first sync sorts it out later.
        const synced = await firstSyncNow(result.value.id);
        recordSignIn(db, result.value, {
          heroPulled: synced.status === 'done' && synced.pulledHero,
        });
        return null;
      }}
      onResend={async () => {
        const result = await sendCode(email.data);
        return result.ok ? null : result.message;
      }}
      onBack={() => router.back()}
    />
  );
}
