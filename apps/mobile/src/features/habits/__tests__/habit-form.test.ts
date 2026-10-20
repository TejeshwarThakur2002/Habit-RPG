import { NEW_HABIT, habitFormSchema } from '../habit-form';

const parse = (overrides: object) => habitFormSchema.safeParse({ ...NEW_HABIT, ...overrides });

describe('habitFormSchema', () => {
  it('cleans the name and keeps the rest', () => {
    const result = parse({ name: '  Read​ 20 pages ', category: 'mind' });
    expect(result.success && result.data).toEqual({
      name: 'Read 20 pages',
      type: 'daily',
      difficulty: 'medium',
      category: 'mind',
      weekdays: 127,
    });
  });

  it('requires a name of at most 60 characters', () => {
    expect(parse({ name: '   ' }).error?.issues[0]?.message).toBe('Give your quest a name');
    expect(parse({ name: 'x'.repeat(61) }).error?.issues[0]?.message).toBe(
      'Use at most 60 characters',
    );
    expect(parse({ name: 'x'.repeat(60) }).success).toBe(true);
  });

  it('needs at least one day for a weekdays habit and keeps the chosen days', () => {
    expect(parse({ name: 'Swim', type: 'weekdays', weekdays: 0 }).error?.issues[0]).toMatchObject({
      path: ['weekdays'],
      message: 'Pick at least one day',
    });
    const ok = parse({ name: 'Swim', type: 'weekdays', weekdays: 1 | 16 });
    expect(ok.success && ok.data.weekdays).toBe(17);
  });

  it('runs daily habits and "don’t" quests every day', () => {
    const daily = parse({ name: 'Water', weekdays: 1 });
    const bad = parse({ name: 'No snacks', type: 'bad', weekdays: 0 });
    expect(daily.success && daily.data.weekdays).toBe(127);
    expect(bad.success && bad.data.weekdays).toBe(127);
  });
});
