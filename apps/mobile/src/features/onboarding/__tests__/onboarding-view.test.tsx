import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingView } from '../onboarding-view';

async function setup(detectedTimeZone = 'America/Toronto') {
  const onFinish = jest.fn();
  await render(<OnboardingView detectedTimeZone={detectedTimeZone} onFinish={onFinish} />);
  return onFinish;
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('OnboardingView', () => {
  it('walks through name, class and time zone, then finishes with clean values', async () => {
    const onFinish = await setup();
    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Hero name'), '  Ada  ');
    await press('Next');

    expect(screen.getByRole('header', { name: 'Choose a class' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Knight/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: /^Mage/ }));
    expect(screen.getByRole('radio', { name: /^Mage/ })).toBeChecked();
    await press('Next');

    expect(screen.getByText('America/Toronto')).toBeOnTheScreen();
    await press('Begin your adventure');
    expect(onFinish).toHaveBeenCalledWith({
      heroName: 'Ada',
      heroClass: 'mage',
      timeZone: 'America/Toronto',
    });
  });

  it('keeps the player on step 1 until the name is long enough', async () => {
    const onFinish = await setup();
    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'A');
    await press('Next');
    expect(screen.getByText('Use at least 2 characters')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('lets the player change the time zone and rejects a bad one', async () => {
    const onFinish = await setup();
    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'Ada');
    await press('Next');
    await press('Next');
    await press('Change');

    await fireEvent.changeText(screen.getByLabelText('Time zone'), 'Toronto');
    await press('Begin your adventure');
    expect(screen.getByText('Enter a time zone like America/Toronto')).toBeOnTheScreen();
    expect(onFinish).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Time zone'), 'Pacific/Auckland');
    await press('Begin your adventure');
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: 'Pacific/Auckland' }),
    );
  });

  it('goes back a step', async () => {
    await setup();
    await fireEvent.changeText(screen.getByLabelText('Hero name'), 'Ada');
    await press('Next');
    await press('Back');
    expect(screen.getByLabelText('Hero name')).toHaveDisplayValue('Ada');
  });
});
