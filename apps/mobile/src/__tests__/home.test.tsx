import { render, screen } from '@testing-library/react-native';

import Home from '../../app/index';

describe('Home placeholder', () => {
  it('renders the app title as a header and a gallery link in development', async () => {
    await render(<Home />);
    expect(screen.getByRole('header', { name: 'Habit RPG' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open UI gallery' })).toBeOnTheScreen();
  });
});
