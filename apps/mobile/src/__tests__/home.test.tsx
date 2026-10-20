import { render, screen } from '@testing-library/react-native';

import Home from '../../app/index';

describe('Home placeholder', () => {
  it('renders the app title as a header', async () => {
    await render(<Home />);
    expect(screen.getByRole('header', { name: 'Habit RPG' })).toBeOnTheScreen();
  });
});
