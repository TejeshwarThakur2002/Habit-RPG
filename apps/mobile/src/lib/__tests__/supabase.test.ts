import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { authErrorMessage, getSupabase, sendCode } from '../supabase';

describe('authErrorMessage', () => {
  it('explains a wrong or expired code', () => {
    expect(authErrorMessage(new AuthApiError('Token has expired', 403, 'otp_expired'))).toMatch(
      /wrong or has expired/,
    );
  });

  it('explains the email rate limit', () => {
    expect(
      authErrorMessage(new AuthApiError('rate limit', 429, 'over_email_send_rate_limit')),
    ).toMatch(/Too many codes/);
  });

  it('explains being offline', () => {
    expect(authErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(
      /Can't reach the server/,
    );
  });

  it('logs anything unexpected and shows a general message', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(authErrorMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('without Supabase settings', () => {
  it('turns email sign-in off instead of crashing, so local play still works', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getSupabase()).toBeNull();
    expect(await sendCode('ada@example.com')).toEqual({
      ok: false,
      message: expect.stringMatching(/isn't set up in this build/),
    });
    warn.mockRestore();
  });
});
