// Reward motion from SCOPE.md section 5.9: the floating "+20 XP", the level-up confetti and
// the sprite hop. Each renders nothing (or holds still) when Reduce Motion is on.

import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../motion';
import { colors, motion, type } from '../tokens';

/** "+20 XP" and "+6 gold" rise 24 pt from a completed row and fade over 600 ms. */
export function FloatingReward({ xp, gold }: { xp: number; gold: number }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: motion.floatingReward,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -24 * progress.value }],
  }));

  // The numbers already show in the hero card's bars, so nothing is lost without the float.
  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.float, style]}
    >
      <Text style={[type.reward, { color: colors.teal }]}>+{xp} XP</Text>
      <Text style={[type.reward, { color: colors.gold }]}>+{gold} gold</Text>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [colors.gold, colors.teal, colors.red, colors.orange] as const;
const CONFETTI_MS = 1200;

export interface ConfettiPiece {
  /** Left edge, as a fraction of the width. */
  x: number;
  delay: number;
  fall: number;
  color: string;
}

/**
 * Up to 30 square "pixels" (section 5.9). A seeded generator keeps the pattern the same on
 * every render and in tests.
 */
export function confettiPieces(count: number, seed = 7): ConfettiPiece[] {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  return Array.from({ length: Math.min(count, 30) }, (_, i) => ({
    x: next(),
    delay: Math.round(next() * 300),
    fall: 120 + Math.round(next() * 120),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? colors.gold,
  }));
}

export function Confetti({ count = 30 }: { count?: number }) {
  const reduceMotion = useReduceMotion();
  const pieces = useMemo(() => confettiPieces(count), [count]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <ConfettiBit key={i} piece={piece} />
      ))}
    </View>
  );
}

function ConfettiBit({ piece }: { piece: ConfettiPiece }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: CONFETTI_MS - piece.delay });
  }, [piece.delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: piece.fall * progress.value }],
  }));
  return (
    <Animated.View
      style={[styles.bit, { left: `${piece.x * 100}%`, backgroundColor: piece.color }, style]}
    />
  );
}

/** The level-up sprite hop: two frames, up and down, a few times. Still with Reduce Motion. */
export function Hop({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    // Steps rather than easing, so it reads as two pixel-art frames.
    const frame = (y: number) => withTiming(y, { duration: 0 });
    offset.value = withRepeat(
      withSequence(
        frame(-8),
        withTiming(-8, { duration: 150 }),
        frame(0),
        withTiming(0, { duration: 150 }),
      ),
      4,
    );
  }, [offset, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  float: { position: 'absolute', right: 0, top: -6, alignItems: 'flex-end' },
  bit: { position: 'absolute', top: 0, width: 6, height: 6 },
});
