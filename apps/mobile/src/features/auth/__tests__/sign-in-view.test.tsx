import { fireEvent, render, screen } from '@testing-library/react-native';

import { SignInView } from '../sign-in-view';

describe('SignInView', () => {
  it('starts the demo', async () => {
    const onTryDemo = jest.fn();
    await render(<SignInView onTryDemo={onTryDemo} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try the demo' }));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });

  it('shows email sign-in as not available yet', async () => {
    await render(<SignInView onTryDemo={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
    expect(screen.getByText(/arrives with the backend/)).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'A pixel knight' })).toBeOnTheScreen();
  });
});
