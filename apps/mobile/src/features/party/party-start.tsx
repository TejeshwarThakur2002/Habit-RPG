import { partyCodeSchema, partyNameSchema } from '@habit-rpg/shared';
import { Button, TextField, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { Text } from 'react-native';

import { Card } from '@/features/stats/card';

/** A hero with no account: parties live on the server, so they need one (D60). */
export function NeedsAccountCard({ onLinkAccount }: { onLinkAccount: () => void }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={type.sectionTitle}>
        Parties need an account
      </Text>
      <Text style={type.secondary}>
        Link an account to team up with friends against the weekly boss. Your hero comes with you.
      </Text>
      <Button label="Link an account" onPress={onLinkAccount} />
    </Card>
  );
}

interface StartCardProps {
  /** Resolves with an error message, or null once it went through. */
  onSubmit: (value: string) => Promise<string | null>;
  disabled: boolean;
}

/** SCOPE.md section 5.5, no party: "Create a party". */
export function CreatePartyCard({ onSubmit, disabled }: StartCardProps) {
  return (
    <StartCard
      title="Create a party"
      note="Up to 4 heroes fight a new boss each week."
      label="Party name"
      button="Create party"
      testID="party-name"
      maxLength={24}
      autoCapitalize="words"
      check={(value) =>
        partyNameSchema.safeParse(value).success ? null : 'Use 3 to 24 characters.'
      }
      onSubmit={onSubmit}
      disabled={disabled}
    />
  );
}

/** SCOPE.md section 5.5, no party: "Join with a code". */
export function JoinPartyCard({ onSubmit, disabled }: StartCardProps) {
  return (
    <StartCard
      title="Join with a code"
      note="Ask a friend for their party's invite code."
      label="Invite code"
      button="Join party"
      testID="party-code"
      maxLength={16}
      autoCapitalize="characters"
      check={(value) =>
        partyCodeSchema.safeParse(value).success ? null : 'Codes are 6 letters and digits.'
      }
      onSubmit={onSubmit}
      disabled={disabled}
    />
  );
}

function StartCard(
  props: StartCardProps & {
    title: string;
    note: string;
    label: string;
    button: string;
    testID: string;
    maxLength: number;
    autoCapitalize: 'words' | 'characters';
    check: (value: string) => string | null;
  },
) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submit = async () => {
    const invalid = props.check(value);
    if (invalid) return setError(invalid);
    setSending(true);
    setError(await props.onSubmit(value));
    setSending(false);
  };
  return (
    <Card>
      <Text accessibilityRole="header" style={type.sectionTitle}>
        {props.title}
      </Text>
      <Text style={type.secondary}>{props.note}</Text>
      <TextField
        label={props.label}
        testID={props.testID}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        maxLength={props.maxLength}
        autoCapitalize={props.autoCapitalize}
        autoCorrect={false}
        error={error}
      />
      <Button
        label={sending ? 'Sending…' : props.button}
        variant="secondary"
        disabled={props.disabled || sending || value.trim() === ''}
        onPress={() => void submit()}
      />
    </Card>
  );
}
