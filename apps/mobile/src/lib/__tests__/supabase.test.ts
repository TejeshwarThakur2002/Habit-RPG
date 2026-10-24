import {
  AuthApiError,
  AuthRetryableFetchError,
  FunctionsFetchError,
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  authErrorMessage,
  deleteAccount,
  deleteErrorMessage,
  getSupabase,
  sendCode,
  syncFailure,
} from '../supabase';

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

describe('deleteErrorMessage', () => {
  it('asks for a connection when the server cannot be reached', () => {
    expect(deleteErrorMessage(new FunctionsFetchError(new Error('offline')))).toMatch(
      /need to be online.*Nothing was deleted/,
    );
  });

  it('logs a server error and asks to try again', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(deleteErrorMessage(new FunctionsHttpError(new Response(null, { status: 500 })))).toBe(
      "Your account couldn't be deleted. Try again.",
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('syncFailure', () => {
  it('retries when the server cannot be reached or fails, but not when it refuses', () => {
    expect(syncFailure(new FunctionsFetchError(new Error('offline')))).toMatchObject({
      kind: 'offline',
    });
    expect(syncFailure(new FunctionsHttpError(new Response(null, { status: 409 })))).toMatchObject({
      kind: 'refused',
      status: 409,
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(syncFailure(new FunctionsHttpError(new Response(null, { status: 503 })))).toMatchObject({
      kind: 'server',
      status: 503,
    });
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
    expect(await deleteAccount()).toEqual({
      ok: false,
      message: expect.stringMatching(/isn't set up in this build/),
    });
    warn.mockRestore();
  });
});
