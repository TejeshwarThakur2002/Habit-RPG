import {
  askHeroChoice,
  closeHeroChoice,
  currentHeroChoice,
  subscribeHeroChoice,
} from '../hero-choice';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

describe('the pending hero choice', () => {
  it('is held until closed, telling its listeners each time', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeHeroChoice(listener);
    askHeroChoice({ accountUserId: ACCOUNT, accountHero: null });
    expect(currentHeroChoice()).toEqual({ accountUserId: ACCOUNT, accountHero: null });
    closeHeroChoice();
    closeHeroChoice();
    expect(currentHeroChoice()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
