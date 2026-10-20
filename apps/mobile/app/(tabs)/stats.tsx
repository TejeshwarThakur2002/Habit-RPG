import { Button } from '@habit-rpg/ui';

import { TabPlaceholder } from '@/components/tab-placeholder';
import { db } from '@/db/client';
import { resetLocalData } from '@/db/queries/local-data';

export default function Stats() {
  return (
    <TabPlaceholder title="Adventure Log" note="Your stats arrive in a Phase 2 update.">
      {/* Settings (with Sign out) comes later in Phase 2; until then this wipes local data and
          returns to sign-in, for the demo or a local hero alike. */}
      <Button label="Reset and sign out" variant="danger" onPress={() => resetLocalData(db)} />
    </TabPlaceholder>
  );
}
