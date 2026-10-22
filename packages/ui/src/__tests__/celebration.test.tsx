import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Confetti, FloatingReward, Hop, confettiPieces } from '../components/celebration';
import { ReduceMotionProvider } from '../motion';

describe('FloatingReward', () => {
  it('shows the XP and gold earned', async () => {
    await render(<FloatingReward xp={20} gold={6} />);
    expect(screen.getByText('+20 XP', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('+6 gold', { includeHiddenElements: true })).toBeTruthy();
  });

  it('is left out when motion is reduced', async () => {
    await render(
      <ReduceMotionProvider value="on">
        <FloatingReward xp={20} gold={6} />
      </ReduceMotionProvider>,
    );
    expect(screen.queryByText('+20 XP', { includeHiddenElements: true })).toBeNull();
  });
});

describe('Confetti', () => {
  it('makes at most 30 pieces, the same ones every time', () => {
    expect(confettiPieces(50)).toHaveLength(30);
    expect(confettiPieces(10)).toEqual(confettiPieces(10));
    for (const piece of confettiPieces(30)) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.x).toBeLessThan(1);
    }
  });

  it('draws nothing when motion is reduced', async () => {
    const { toJSON } = await render(
      <ReduceMotionProvider value="on">
        <Confetti />
      </ReduceMotionProvider>,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('Hop', () => {
  it('keeps its content on screen with or without motion', async () => {
    await render(
      <ReduceMotionProvider value="on">
        <Hop>
          <Text>Hero</Text>
        </Hop>
      </ReduceMotionProvider>,
    );
    expect(screen.getByText('Hero')).toBeOnTheScreen();
  });
});
