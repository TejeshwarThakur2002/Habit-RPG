import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LinkAccountView, type LinkAccountViewProps } from '../link-account-view';

async function show(overrides: Partial<LinkAccountViewProps> = {}) {
  const props = {
    heroName: 'Ada',
    onSendCode: jest.fn(() => Promise.resolve<string | null>(null)),
    onVerify: jest.fn(() => Promise.resolve<string | null>(null)),
    onCancel: jest.fn(),
    ...overrides,
  };
  await render(<LinkAccountView {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole('button', { name });

async function sendTo(email: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.press(button('Send code'));
}

describe('LinkAccountView', () => {
  it('promises the hero stays, then asks for the code sent to that email', async () => {
    const { onSendCode, onVerify } = await show();
    expect(screen.getByRole('header', { name: 'Link an account' })).toBeOnTheScreen();
    expect(screen.getByText(/keep Ada on your account/)).toBeOnTheScreen();

    await sendTo('ada@example.com');
    expect(onSendCode).toHaveBeenCalledWith('ada@example.com');
    expect(await screen.findByText('We sent a 6-digit code to ada@example.com.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('ada@example.com', '123456'));
  });

  it('stays on the email step when the code could not be sent', async () => {
    await show({ onSendCode: () => Promise.resolve("Can't reach the server.") });
    await sendTo('ada@example.com');
    expect(await screen.findByText("Can't reach the server.")).toBeOnTheScreen();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('goes back to change the email, or cancels', async () => {
    const { onCancel } = await show();
    await sendTo('ada@example.com');
    await fireEvent.press(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(button('Send code')).toBeOnTheScreen();
    await fireEvent.press(button('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
