import { router } from 'expo-router';

import { db } from '@/db/client';
import { resetLocalData } from '@/db/queries/local-data';
import { getSettings } from '@/db/queries/settings';
import { DeleteAccountView } from '@/features/settings/delete-account-view';
import { deleteAccount, signOutLocally } from '@/lib/supabase';

/** `modal/delete-account`, opened from Settings when signed in (SCOPE.md F10). */
export default function DeleteAccount() {
  return (
    <DeleteAccountView
      email={getSettings(db).accountEmail}
      onDelete={async () => {
        const result = await deleteAccount();
        if (!result.ok) return result.message;
        // The account is gone on the server; now this phone forgets it too, which sends the
        // route guard back to sign-in.
        await signOutLocally().catch((error: unknown) =>
          console.warn('Clearing the session failed', error),
        );
        resetLocalData(db);
        return null;
      }}
      onCancel={() => router.back()}
    />
  );
}
