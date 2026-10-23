/* global jest */
// react-native-reorderable-list animates with Reanimated APIs beyond the small mock in
// packages/ui/jest.setup.js. Tests can't drag anyway, so the list renders as plain views;
// reordering is tested through the "Move up" / "Move down" actions and the query tests.
jest.mock('react-native-reorderable-list', () => {
  const { ScrollView, View } = require('react-native');
  const { createElement } = require('react');
  return {
    ScrollViewContainer: ScrollView,
    NestedReorderableList: ({ data, keyExtractor, renderItem }) =>
      createElement(
        View,
        null,
        data.map((item, index) =>
          createElement(View, { key: keyExtractor(item, index) }, renderItem({ item, index })),
        ),
      ),
    useReorderableDrag: () => () => {},
  };
});

// expo-haptics talks to the Taptic Engine; tests only check that the right feedback is asked for.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// The native time picker can't render in Jest; a plain view keeps its label for queries.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  const { createElement } = require('react');
  const Picker = (props) => createElement(View, { accessibilityLabel: props.accessibilityLabel });
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

// AsyncStorage holds the encrypted session (D33); its package ships this in-memory Jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
