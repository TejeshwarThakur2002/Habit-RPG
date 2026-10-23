import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInView, type SignInViewProps } from '../sign-in-view';

async function show(overrides: Partial<SignInViewProps> = {}) {
  const props = {
    onSendCode: jest.fn(() => Promise.resolve<string | null>(null)),
    onTryDemo: jest.fn(),
    onStartLocal: jest.fn(),
    ...overrides,
  };
  await render(<SignInView {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole('button', { name });

describe('SignInView', () => {
  it('starts the demo', async () => {
    const { onTryDemo } = await show();
    await fireEvent.press(button('Try the demo'));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
  });

  it('starts a local game without an account', async () => {
    const { onStartLocal } = await show();
    await fireEvent.press(button('Start without an account'));
    expect(onStartLocal).toHaveBeenCalledTimes(1);
  });

  it('sends a code to a cleaned-up email only once it looks valid', async () => {
    const { onSendCode } = await show();
    expect(button('Send code')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@');
    expect(button('Send code')).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Email'), '  Ada@Example.COM ');
    await fireEvent.press(button('Send code'));
    await waitFor(() => expect(onSendCode).toHaveBeenCalledWith('ada@example.com'));
  });

  it('shows why a code could not be sent', async () => {
    await show({
      onSendCode: () => Promise.resolve('Too many codes asked for. Wait a minute and try again.'),
    });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
    await fireEvent.press(button('Send code'));
    expect(await screen.findByText(/Too many codes asked for/)).toBeOnTheScreen();
  });

  it('points out a mistyped email after leaving the field', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ada.example.com');
    await fireEvent(screen.getByLabelText('Email'), 'blur');
    expect(screen.getByText('Enter an email like you@example.com')).toBeOnTheScreen();
  });
});
