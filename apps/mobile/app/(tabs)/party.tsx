import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { db } from '@/db/client';
import { getPartyView } from '@/db/queries/party';
import { getSettings } from '@/db/queries/settings';
import { useDbQuery } from '@/db/use-db-query';
import { runPartyAction } from '@/features/party/party-actions';
import { PartyView, type PartyMode } from '@/features/party/party-view';

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
  // A fresh snapshot each time the tab opens; offline, it shows what it last saw (D60).
  useFocusEffect(
    useCallback(() => {
      if (mode !== 'account') return;
      void runPartyAction(db, { action: 'state' }).then((error) => {
        if (error) console.info('party: showing the stored party;', error);
      });
    }, [mode]),
  );
  return (
    <PartyView
      mode={mode}
      party={party}
      onCreate={(name) => runPartyAction(db, { action: 'create', name })}
      onJoin={(code) => runPartyAction(db, { action: 'join', code })}
      onLeave={() => runPartyAction(db, { action: 'leave' })}
      onLinkAccount={() => router.push('/modal/link-account')}
    />
  );
}
