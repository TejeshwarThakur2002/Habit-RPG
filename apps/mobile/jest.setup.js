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
