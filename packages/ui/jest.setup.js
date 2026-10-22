/* global jest */
// Reanimated 4.7's own Jest mock and web resolver both fail here (the mock loads the native
// module; the web build needs react-native-web, which this app does not use). This mock
// covers only the APIs packages/ui uses and jumps straight to final values (DECISIONS.md D13).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (v) => v;
  const Easing = { out: () => identity, in: () => identity, inOut: () => identity, quad: identity };
  return {
    __esModule: true,
    default: { View },
    View,
    Easing,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: (value) => value,
    useReducedMotion: () => false,
  };
});

// Safe-area insets come from native code; its own Jest mock reports zero insets.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
