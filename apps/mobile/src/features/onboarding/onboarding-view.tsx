import type { HeroClass } from '@habit-rpg/game-core';
import { Button, TextField, colors, radii, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';

import { CLASSES, ClassCard } from './class-card';
import { fieldError, heroNameSchema, timeZoneSchema, type HeroInput } from './hero-input';

export interface OnboardingViewProps {
  detectedTimeZone: string;
  onFinish: (input: HeroInput) => void;
}

const STEPS = ['Name your hero', 'Choose a class', 'Your time zone'] as const;

/** SCOPE.md F1 and section 5.8: hero name, class and time zone, one step at a time. */
export function OnboardingView({ detectedTimeZone, onFinish }: OnboardingViewProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [heroClass, setHeroClass] = useState<HeroClass>('knight');
  const [zone, setZone] = useState(detectedTimeZone);
  const [editingZone, setEditingZone] = useState(false);

  const nameError = fieldError(heroNameSchema, name);
  const zoneError = fieldError(timeZoneSchema, zone);

  const next = () => {
    if (step === 0 && nameError) return setNameTouched(true);
    if (step < STEPS.length - 1) return setStep(step + 1);
    if (zoneError) return setEditingZone(true);
    onFinish({
      heroName: heroNameSchema.parse(name),
      heroClass,
      timeZone: timeZoneSchema.parse(zone),
    });
  };

  return (
    <KeyboardScreen top={32}>
      <View style={styles.body}>
        <View
          accessible
          accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}
          style={styles.dots}
        >
          {STEPS.map((label, i) => (
            <View key={label} style={[styles.dot, i <= step && styles.dotDone]} />
          ))}
        </View>
        <Text accessibilityRole="header" style={type.screenTitle}>
          {STEPS[step]}
        </Text>

        {step === 0 && (
          <TextField
            label="Hero name"
            value={name}
            onChangeText={setName}
            onBlur={() => setNameTouched(true)}
            maxLength={20}
            autoFocus
            hint="2 to 20 characters. Your party sees it."
            error={nameTouched ? nameError : null}
          />
        )}

        {step === 1 && (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Hero class"
            style={styles.classes}
          >
            {CLASSES.map((c) => (
              <ClassCard
                key={c.value}
                {...c}
                selected={c.value === heroClass}
                onSelect={setHeroClass}
              />
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.zone}>
            <Text style={type.secondary}>
              Days start and end at midnight here, and close at 3 am.
            </Text>
            {editingZone ? (
              <TextField
                label="Time zone"
                value={zone}
                onChangeText={setZone}
                autoCapitalize="none"
                autoCorrect={false}
                error={zoneError}
              />
            ) : (
              <View style={styles.zoneRow}>
                <Text style={type.bodyStrong}>{zone}</Text>
                <Button label="Change" variant="ghost" onPress={() => setEditingZone(true)} />
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label={step === STEPS.length - 1 ? 'Begin your adventure' : 'Next'}
          onPress={next}
        />
        {step > 0 && <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />}
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.section },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 24, height: 6, borderRadius: radii.bar, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.gold },
  classes: { flexDirection: 'row', gap: 8 },
  zone: { gap: 12 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { gap: 8 },
});
