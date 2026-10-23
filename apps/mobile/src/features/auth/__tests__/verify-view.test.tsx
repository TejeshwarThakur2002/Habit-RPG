import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { VerifyView, type VerifyViewProps } from '../verify-view';

async function show(overrides: Partial<VerifyViewProps> = {}) {
  const props = {
    email: 'ada@example.com',
    onVerify: jest.fn(() => Promise.resolve<string | null>(null)),
    onResend: jest.fn(() => Promise.resolve<string | null>(null)),
    onBack: jest.fn(),
    ...overrides,
  };
  await render(<VerifyView {...props} />);
  return props;
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

afterEach(() => jest.useRealTimers());

describe('VerifyView', () => {
  it('checks the code by itself once all 6 digits are in', async () => {
    const { onVerify } = await show();
    expect(screen.getByText('We sent a 6-digit code to ada@example.com.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Code'), '12345');
    expect(onVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Code'), '12 34 56');
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('123456'));
  });

  it('shows a wrong or expired code', async () => {
    await show({ onVerify: () => Promise.resolve('That code is wrong or has expired.') });
    await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
    expect(await screen.findByText('That code is wrong or has expired.')).toBeOnTheScreen();
  });

  it('lets a new code be asked for after 30 seconds', async () => {
    jest.useFakeTimers();
    const { onResend } = await show();
    expect(button('Resend in 30 s')).toBeDisabled();
    for (let i = 0; i < 30; i += 1) await act(() => jest.advanceTimersByTime(1000));
    await fireEvent.press(button('Resend code'));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('A new code is on its way to ada@example.com.'),
    ).toBeOnTheScreen();
    expect(button('Resend in 30 s')).toBeDisabled();
  });

  it('goes back to change the email', async () => {
    const { onBack } = await show();
    await fireEvent.press(button('Use a different email'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
