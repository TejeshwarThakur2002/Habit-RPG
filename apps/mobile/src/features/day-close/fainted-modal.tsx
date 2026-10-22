import { Button, Modal, type } from '@habit-rpg/ui';
import { StyleSheet, Text } from 'react-native';

import type { FaintNotice } from '@/db/types';

/** The gentle wording from SCOPE.md section 5.8, with what was lost and missed. */
export function faintMessage(notice: FaintNotice): string {
  const gold = notice.goldLost === 1 ? '1 gold' : `${notice.goldLost} gold`;
  const progress = notice.xpLost > 0 ? ' and your progress to the next level' : '';
  return `You lost ${gold}${progress}. Rest up and try again.`;
}

export interface FaintedModalProps {
  notice: FaintNotice | null;
  onClose: () => void;
}

/** "You fainted" (SCOPE.md F4): shown once after a day close brings HP to 0. */
export function FaintedModal({ notice, onClose }: FaintedModalProps) {
  return (
    <Modal visible={notice !== null} title="You fainted!" onClose={onClose}>
      {notice && (
        <>
          <Text style={[type.body, styles.center]}>{faintMessage(notice)}</Text>
          {notice.missed.length > 0 && (
            <Text style={[type.secondary, styles.center]}>Missed: {notice.missed.join(', ')}</Text>
          )}
          <Button label="Continue" onPress={onClose} />
        </>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
