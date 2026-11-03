import {
  Button,
  MemberRow,
  ScreenHeader,
  colors,
  spacing,
  type,
  type ColorToken,
} from '@habit-rpg/ui';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PartyMemberView, PartyView as Party } from '@/db/queries/party';
import { Card } from '@/features/stats/card';

import { confirmLeave } from './confirm-leave';
import { CreatePartyCard, JoinPartyCard, NeedsAccountCard } from './party-start';

export type PartyMode = 'account' | 'local' | 'demo';

export interface PartyViewProps {
  mode: PartyMode;
  party: Party | null;
  /** Each resolves with an error message, or null once it went through. */
  onCreate: (name: string) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
  onLeave: () => Promise<string | null>;
  onLinkAccount: () => void;
}

/** SCOPE.md section 5.5: the Party tab. The boss card and battle log come in the next PR (D60). */
export function PartyView({
  mode,
  party,
  onCreate,
  onJoin,
  onLeave,
  onLinkAccount,
}: PartyViewProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const run = (action: (value: string) => Promise<string | null>) => async (value: string) => {
    setBusy(true);
    const error = await action(value);
    setBusy(false);
    return error;
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      {party ? (
        <InParty party={party} readOnly={mode === 'demo'} busy={busy} onLeave={run(onLeave)} />
      ) : (
        <>
          <ScreenHeader title="Party" />
          {mode === 'local' ? (
            <NeedsAccountCard onLinkAccount={onLinkAccount} />
          ) : (
            <>
              <CreatePartyCard onSubmit={run(onCreate)} disabled={busy} />
              <JoinPartyCard onSubmit={run(onJoin)} disabled={busy} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function InParty(props: {
  party: Party;
  readOnly: boolean;
  busy: boolean;
  onLeave: (value: string) => Promise<string | null>;
}) {
  const { party, readOnly, busy, onLeave } = props;
  const [failure, setFailure] = useState<string | null>(null);
  const days = party.boss?.daysLeft;
  return (
    <>
      <View style={styles.header}>
        <ScreenHeader title={party.name} />
        {days !== undefined && (
          <Text style={type.meta}>{days === 1 ? '1 day left' : `${days} days left`}</Text>
        )}
      </View>
      <Card>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Party damage this week
        </Text>
        {party.members
          .filter((m) => m.active)
          .map((m, i) => (
            <MemberRow
              key={m.userId}
              name={m.name ?? 'A former member'}
              damage={m.damage}
              avatarColor={avatarColor(m, i)}
              isYou={m.isYou}
            />
          ))}
      </Card>
      <Card>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Invite friends
        </Text>
        <Text
          accessibilityLabel={`Invite code ${party.code.split('').join(' ')}`}
          style={type.body}
        >
          Invite code: <Text style={styles.code}>{party.code}</Text>
        </Text>
      </Card>
      {!readOnly && (
        <View style={styles.leave}>
          {failure && (
            <Text accessibilityLiveRegion="polite" style={[type.meta, styles.failure]}>
              {failure}
            </Text>
          )}
          <Button
            label={busy ? 'Leaving…' : 'Leave party'}
            variant="ghost"
            disabled={busy}
            onPress={() =>
              confirmLeave(party.name, () => void onLeave('').then((error) => setFailure(error)))
            }
          />
        </View>
      )}
    </>
  );
}

const OTHERS: readonly ColorToken[] = ['teal', 'orange', 'gold', 'red'];

/** Yours is purple; the others a different colour each, in the order they're listed. */
function avatarColor(member: PartyMemberView, index: number): ColorToken {
  return member.isYou ? 'purple' : OTHERS[index % OTHERS.length]!;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
  header: { gap: 2 },
  code: { ...type.name, color: colors.gold, letterSpacing: 2 },
  leave: { gap: 8 },
  failure: { color: colors.red, textAlign: 'center' },
});
