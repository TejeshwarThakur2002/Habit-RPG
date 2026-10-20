// Overlays from SCOPE.md section 5.2: Modal, BottomSheet and Toast. Each fades or slides in,
// or appears instantly when Reduce Motion is on.

import { useEffect, type ReactNode } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../motion';
import { borders, colors, radii, spacing, type } from '../tokens';

interface OverlayProps {
  visible: boolean;
  title: string;
  /** Back button, swipe down or tapping outside. */
  onClose: () => void;
  children: ReactNode;
}

/** A centred dialog (level-up, fainted, boss victory, confirmations). */
export function Modal({ visible, title, onClose, children }: OverlayProps) {
  const reduceMotion = useReduceMotion();
  return (
    <RNModal
      transparent
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal onAccessibilityEscape={onClose} style={styles.dialog}>
          <Text accessibilityRole="header" style={[type.name, styles.center]}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

/** A sheet from the bottom of the screen (habit editor, join party). */
export function BottomSheet({ visible, title, onClose, children }: OverlayProps) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
    <RNModal
      transparent
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.scrim}
        />
        {/* The scrim is hidden from screen readers by the modal sheet; they close it with the
            escape gesture (VoiceOver) or the back button (TalkBack) instead. */}
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          testID="bottom-sheet"
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.cardPadding }]}
        >
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={type.sectionTitle}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

export const TOAST_DURATION_MS = 5000;

export interface ToastProps {
  message: string;
  /** e.g. Undo after a purchase (SCOPE.md section 5.6). */
  action?: { label: string; onPress: () => void };
  tone?: 'info' | 'error';
  /** Called after `duration` ms; leave out to keep the toast up. */
  onDismiss?: () => void;
  duration?: number;
}

/** A short status message, announced politely by screen readers. */
export function Toast({ message, action, tone = 'info', onDismiss, duration }: ToastProps) {
  const ms = duration ?? TOAST_DURATION_MS;
  useEffect(() => {
    if (!onDismiss) return;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [message, ms, onDismiss]);

  return (
    <View style={[styles.toast, tone === 'error' && styles.toastError]}>
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[type.body, styles.toastText]}
      >
        {message}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={8}
          style={styles.toastAction}
        >
          <Text style={[type.reward, styles.toastActionText]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screenX,
    backgroundColor: 'rgba(20, 18, 31, 0.8)',
  },
  dialog: {
    gap: 14,
    padding: 20,
    borderRadius: radii.heroCard,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  center: { textAlign: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 18, 31, 0.6)' },
  sheet: {
    gap: 14,
    paddingTop: 10,
    paddingHorizontal: spacing.screenX,
    borderTopLeftRadius: radii.heroCard,
    borderTopRightRadius: radii.heroCard,
    borderWidth: borders.card,
    borderBottomWidth: 0,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.row,
    borderWidth: borders.card,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface2,
  },
  toastError: { borderColor: colors.red },
  toastText: { flex: 1 },
  toastAction: { minHeight: 32, justifyContent: 'center' },
  toastActionText: { color: colors.gold, fontSize: 14 },
});
