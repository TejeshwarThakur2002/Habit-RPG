import { recordSignIn } from '@/db/queries/local-data';
import { callParty } from '@/lib/supabase';
import { createTestDb } from '@/test/test-db';

import { claimReward } from '../party-actions';

jest.mock('@/lib/supabase', () => ({ callParty: jest.fn() }));
const call = jest.mocked(callParty);

describe('claimReward', () => {
  it('syncs straight after a claim that went through, so the gold arrives', async () => {
    const db = await createTestDb();
    recordSignIn(db, { id: '00000000-0000-4000-8000-00000000000a', email: 'a@example.com' });
    const sync = jest.fn();
    call.mockResolvedValueOnce({ ok: true, state: { party: null } });
    expect(await claimReward(db, 'b', sync)).toBeNull();
    expect(call).toHaveBeenCalledWith({ action: 'claim_reward', boss_week_id: 'b' });
    expect(sync).toHaveBeenCalledTimes(1);

    call.mockResolvedValueOnce({ ok: false, message: "You've already claimed this reward." });
    expect(await claimReward(db, 'b', sync)).toBe("You've already claimed this reward.");
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
