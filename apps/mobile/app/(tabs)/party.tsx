import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { getPartyView } from '@/db/queries/party';
import { getSettings } from '@/db/queries/settings';
import { useDbQuery } from '@/db/use-db-query';
import { claimReward, runPartyAction } from '@/features/party/party-actions';
import { copyCode, shareCode } from '@/features/party/invite';
import { startLiveParty } from '@/features/party/party-live';
import { PartyView, type PartyMode } from '@/features/party/party-view';
import { syncNow } from '@/features/sync/use-sync-display';
import { watchPartyEvents } from '@/lib/supabase';
import { useMinuteClock } from '@/lib/use-minute-clock';

function readParty() {
  const settings = getSettings(db);
  const mode: PartyMode = settings.demoMode
    ? 'demo'
    : settings.accountUserId === null
      ? 'local'
      : 'account';
  return { mode, party: getPartyView(db, Date.now()) };
}

export default function Party() {
  const { mode, party } = useDbQuery(readParty);
  const now = useMinuteClock();
  const [refreshFailed, setRefreshFailed] = useState(false);
  const partyId = party?.id ?? null;
  // A fresh snapshot each time the tab opens, and again on each new battle-log line while it's
  // open; offline, it shows what it last saw (D60, D61, D63).
  useFocusEffect(
    useCallback(() => {
      if (mode !== 'account') return;
      const refresh = () =>
        void runPartyAction(db, { action: 'state' }).then((error) => {
          if (error) console.info('party: showing the stored party;', error);
          setRefreshFailed(error !== null);
        });
      refresh();
      if (partyId === null) return;
      return startLiveParty(partyId, {
        watch: watchPartyEvents,
        refresh,
        setTimer: (run, ms) => setTimeout(run, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      });
    }, [mode, partyId]),
  );
  // An action that went through brought a fresh snapshot with it.
  const act = async (action: Promise<string | null>) => {
    const error = await action;
    if (error === null) setRefreshFailed(false);
    return error;
  };
  return (
    <PartyView
      mode={mode}
      party={party}
      refreshFailed={refreshFailed}
      now={now}
      onCreate={(name) => act(runPartyAction(db, { action: 'create', name }))}
      onJoin={(code) => act(runPartyAction(db, { action: 'join', code }))}
      onLeave={() => act(runPartyAction(db, { action: 'leave' }))}
      onClaim={(bossWeekId) => act(claimReward(db, bossWeekId, syncNow))}
      onCopy={copyCode}
      onShare={shareCode}
      onLinkAccount={() => router.push('/modal/link-account')}
    />
  );
}
