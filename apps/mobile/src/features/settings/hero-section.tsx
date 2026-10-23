import { Button, TextField, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { fieldError, heroNameSchema, timeZoneSchema } from '@/features/onboarding/hero-input';

export interface HeroFields {
  heroName: string;
  timezone: string;
}

export interface HeroSectionProps {
  saved: HeroFields;
  /** The phone's own zone, offered when the hero's differs (e.g. after travelling). */
  deviceTimeZone: string;
  onSave: (fields: HeroFields) => void;
}

/** Hero name and time zone, validated like onboarding (SCOPE.md F1 and F10). */
export function HeroSection({ saved, deviceTimeZone, onSave }: HeroSectionProps) {
  const [name, setName] = useState(saved.heroName);
  const [zone, setZone] = useState(saved.timezone);
  const [justSaved, setJustSaved] = useState(false);
  const nameResult = heroNameSchema.safeParse(name);
  const zoneResult = timeZoneSchema.safeParse(zone);
  const changed =
    (nameResult.success && nameResult.data !== saved.heroName) ||
    (zoneResult.success && zoneResult.data !== saved.timezone);
  const canSave = nameResult.success && zoneResult.success && changed;

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setJustSaved(false);
  };
  const save = () => {
    if (!nameResult.success || !zoneResult.success) return;
    onSave({ heroName: nameResult.data, timezone: zoneResult.data });
    setName(nameResult.data);
    setZone(zoneResult.data);
    setJustSaved(true);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.section}>
      <TextField
        label="Hero name"
        value={name}
        onChangeText={edit(setName)}
        maxLength={20}
        error={fieldError(heroNameSchema, name)}
      />
      <TextField
        label="Time zone"
        value={zone}
        onChangeText={edit(setZone)}
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldError(timeZoneSchema, zone)}
        hint="Days start at midnight here and close at 3 am."
      />
      {zone.trim() !== deviceTimeZone && (
        <Button
          label={`Use this phone's zone (${deviceTimeZone})`}
          variant="ghost"
          onPress={() => edit(setZone)(deviceTimeZone)}
        />
      )}
      <Button label="Save changes" disabled={!canSave} onPress={save} />
      <Text accessibilityLiveRegion="polite" style={type.meta}>
        {justSaved ? 'Saved' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
});
