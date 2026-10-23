import { describe, expect, it } from 'vitest';

import { cleanText, isValidTimeZone } from './text.ts';

describe('cleanText', () => {
  it('strips control and invisible characters and tidies spaces', () => {
    expect(cleanText('  Sir\u0007  Commit​ ')).toBe('Sir Commit');
    expect(cleanText('Ada\nLovelace')).toBe('Ada Lovelace');
    expect(cleanText('evil‮eman')).toBe('evileman');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zone names and rejects anything else', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('Pacific/Auckland')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
