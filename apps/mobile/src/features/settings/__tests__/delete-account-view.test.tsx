import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeleteAccountView } from '../delete-account-view';

async function setup(onDelete = jest.fn(async () => null as string | null)) {
  const onCancel = jest.fn();
  await render(
    <DeleteAccountView email="ada@example.com" onDelete={onDelete} onCancel={onCancel} />,
  );
  return { onDelete, onCancel };
}

const deleteButton = () => screen.getByRole('button', { name: 'Delete account' });
const confirmField = () => screen.getByLabelText('Type DELETE to confirm');

describe('DeleteAccountView', () => {
  it('says what goes, and stays off until DELETE is typed', async () => {
    const { onDelete } = await setup();
    expect(screen.getByText(/ada@example.com.*can't be undone/s)).toBeOnTheScreen();
    expect(deleteButton()).toBeDisabled();
    await fireEvent.changeText(confirmField(), 'delete');
    expect(deleteButton()).toBeDisabled();
    await fireEvent.changeText(confirmField(), 'DELETE');
    await fireEvent.press(deleteButton());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows why it failed and lets the player try again', async () => {
    const onDelete = jest.fn(async () => 'You need to be online to do this. Nothing was deleted.');
    await setup(onDelete);
    await fireEvent.changeText(confirmField(), 'DELETE');
    await fireEvent.press(deleteButton());
    expect(await screen.findByText(/You need to be online/)).toBeOnTheScreen();
    expect(deleteButton()).toBeEnabled();
  });

  it('can be cancelled', async () => {
    const { onCancel, onDelete } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
