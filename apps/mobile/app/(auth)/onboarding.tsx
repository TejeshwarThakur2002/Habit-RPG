import { useState } from 'react';

import { db } from '@/db/client';
import { createHero } from '@/db/queries/local-data';
import { getSettings } from '@/db/queries/settings';
import { OnboardingView } from '@/features/onboarding/onboarding-view';
import { deviceTimeZone } from '@/lib/device';
import { firstSyncNow } from '@/sync/sync-runner';

export default function Onboarding() {
  const [detected] = useState(deviceTimeZone);
  // createHero marks onboarding done, and the route guard then opens the tabs.
  return (
    <OnboardingView
      detectedTimeZone={detected}
      onFinish={(input) => {
        createHero(db, { ...input, now: Date.now() });
        // Signed in first: the new hero goes to the account as its first sync (D48).
        const { accountUserId } = getSettings(db);
        if (accountUserId) void firstSyncNow(accountUserId);
      }}
    />
  );
}
