import { fieldError, heroInputSchema, heroNameSchema, timeZoneSchema } from '../hero-input';

describe('hero name', () => {
  // cleanText itself is tested in packages/shared.
  it('accepts 2 to 20 characters after cleaning', () => {
    expect(fieldError(heroNameSchema, 'Al')).toBeNull();
    expect(fieldError(heroNameSchema, 'A'.repeat(20))).toBeNull();
    expect(fieldError(heroNameSchema, ' A ')).toBe('Use at least 2 characters');
    expect(fieldError(heroNameSchema, 'A'.repeat(21))).toBe('Use at most 20 characters');
  });
});

describe('time zone', () => {
  it('accepts IANA zone names with spaces around them and rejects anything else', () => {
    expect(fieldError(timeZoneSchema, ' Asia/Kolkata ')).toBeNull();
    expect(fieldError(timeZoneSchema, 'Toronto')).toBe('Enter a time zone like America/Toronto');
  });
});

describe('heroInputSchema', () => {
  it('returns the cleaned values', () => {
    expect(
      heroInputSchema.parse({ heroName: ' Ada ', heroClass: 'mage', timeZone: 'Europe/London' }),
    ).toEqual({ heroName: 'Ada', heroClass: 'mage', timeZone: 'Europe/London' });
  });

  it('rejects an unknown class', () => {
    expect(
      heroInputSchema.safeParse({ heroName: 'Ada', heroClass: 'bard', timeZone: 'UTC' }).success,
    ).toBe(false);
  });
});
