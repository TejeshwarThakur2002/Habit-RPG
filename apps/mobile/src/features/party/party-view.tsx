import {
  Button,
  MemberRow,
  ScreenHeader,
  Toast,
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
import { BattleLog, BossFight, InviteCard, StaleBanner, Victory } from './party-board';
import { CreatePartyCard, JoinPartyCard, NeedsAccountCard } from './party-start';
import { battleLogLines, nextBossText, staleText, type LogLine } from './party-text';

export type PartyMode = 'account' | 'local' | 'demo';

export interface PartyViewProps {
  mode: PartyMode;
  party: Party | null;
  /** The last refresh didn't reach the server, so the tab shows what it stored. */
  refreshFailed: boolean;
  now: number;
  /** Each resolves with an error message, or null once it went through. */
  onCreate: (name: string) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
  onLeave: () => Promise<string | null>;
  onClaim: (bossWeekId: string) => Promise<string | null>;
  onCopy: (code: string) => Promise<void>;
  onShare: (code: string) => Promise<void>;
  onLinkAccount: () => void;
}

/** SCOPE.md section 5.5: the Party tab (D60 to D62). */
export function PartyView({
  mode,
  party,
  refreshFailed,
  now,
  onCreate,
  onJoin,
  onLeave,
  onClaim,
  onCopy,
  onShare,
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
  const [toast, setToast] = useState<string | null>(null);
  const copy = async (code: string) => {
    await onCopy(code);
    setToast('Code copied');
  };
  const claim = async (bossWeekId: string) => {
    const error = await onClaim(bossWeekId);
    if (error === null) setToast('+50 gold claimed');
    return error;
  };
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {party ? (
          <InParty
            party={party}
            readOnly={mode === 'demo'}
            stale={mode === 'account' ? staleText(party, refreshFailed, now) : null}
            lines={battleLogLines(party, now)}
            countdown={nextBossText(party.timezone, now)}
            onClaim={claim}
            onCopy={() => void copy(party.code)}
            onShare={() => void onShare(party.code)}
            busy={busy}
            onLeave={run(onLeave)}
          />
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
      {toast && (
        <View style={styles.toast}>
          <Toast key={toast} message={toast} onDismiss={() => setToast(null)} />
        </View>
      )}
    </View>
  );
}

function InParty(props: {
  party: Party;
  readOnly: boolean;
  stale: string | null;
  lines: LogLine[];
  countdown: string;
  onClaim: (bossWeekId: string) => Promise<string | null>;
  onCopy: () => void;
  onShare: () => void;
  busy: boolean;
  onLeave: (value: string) => Promise<string | null>;
}) {
  const { party, readOnly, stale, lines, countdown, busy, onLeave } = props;
  const boss = party.boss;
  const [failure, setFailure] = useState<string | null>(null);
  const days = party.boss?.daysLeft;
  return (
    <>
      <View style={styles.header}>
        <ScreenHeader title={party.name} />
        {days != null && (
          <Text style={type.meta}>{days === 1 ? '1 day left' : `${days} days left`}</Text>
        )}
      </View>
      {stale && <StaleBanner text={stale} />}
      {boss && <BossFight boss={boss} />}
      {boss?.defeated && (
        <Victory
          claimed={boss.claimed}
          readOnly={readOnly}
          countdown={countdown}
          onClaim={() => props.onClaim(boss.id)}
        />
      )}
      <Card>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Party damage this week
        </Text>
        {party.members
          .filter((m) => m.active)
          .map((m) => (
            <MemberRow
              key={m.userId}
              name={m.name ?? 'A former member'}
              damage={m.damage}
              avatarColor={avatarColor(party.members, m)}
              isYou={m.isYou}
            />
          ))}
      </Card>
      <BattleLog lines={lines} />
      <InviteCard code={party.code} onCopy={props.onCopy} onShare={props.onShare} />
      {!readOnly && (
        <View style={styles.leave}>
          {failure && (
            <Text accessibilityLiveRegion="polite" style={[type.meta, styles.failure]}>
              {failure}
            </Text>
          )}
          <Button
            label={busy ? 'Leaving…' : 'Leave party'}
            variant="danger"
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

/**
 * Yours is purple; the others a different colour each. Picked by id, not by rank, so a member
 * keeps their colour when the damage order changes.
 */
function avatarColor(members: PartyMemberView[], member: PartyMemberView): ColorToken {
  if (member.isYou) return 'purple';
  const others = members.filter((m) => !m.isYou).map((m) => m.userId);
  others.sort();
  return OTHERS[others.indexOf(member.userId) % OTHERS.length]!;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 32 },
  header: { gap: 2 },
  leave: { gap: 8 },
  failure: { color: colors.red, textAlign: 'center' },
  toast: { position: 'absolute', left: spacing.screenX, right: spacing.screenX, bottom: 16 },
});
