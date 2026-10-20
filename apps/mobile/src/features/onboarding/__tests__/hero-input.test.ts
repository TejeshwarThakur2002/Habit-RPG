import {
  cleanHeroName,
  fieldError,
  heroInputSchema,
  heroNameSchema,
  isValidTimeZone,
  timeZoneSchema,
} from '../hero-input';

describe('hero name', () => {
  it('strips control and invisible characters and tidies spaces', () => {
    expect(cleanHeroName('  Sir\u0007  Commit\u200B ')).toBe('Sir Commit');
    expect(cleanHeroName('Ada\nLovelace')).toBe('Ada Lovelace');
  });

  it('accepts 2 to 20 characters after cleaning', () => {
    expect(fieldError(heroNameSchema, 'Al')).toBeNull();
    expect(fieldError(heroNameSchema, 'A'.repeat(20))).toBeNull();
    expect(fieldError(heroNameSchema, ' A ')).toBe('Use at least 2 characters');
    expect(fieldError(heroNameSchema, 'A'.repeat(21))).toBe('Use at most 20 characters');
  });
});

describe('time zone', () => {
  it('accepts IANA zone names and rejects anything else', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('Pacific/Auckland')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
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
