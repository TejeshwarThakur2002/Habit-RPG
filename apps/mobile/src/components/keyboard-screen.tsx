import { colors, spacing } from '@habit-rpg/ui';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A full screen with a form whose actions sit at the bottom and rise above the keyboard.
 * The safe-area padding lives on an inner view: with behavior="padding", KeyboardAvoidingView
 * replaces its own bottom padding with the keyboard height, which would drop the inset.
 */
export function KeyboardScreen({ top = 32, children }: { top?: number; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + top, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.screenX },
});
