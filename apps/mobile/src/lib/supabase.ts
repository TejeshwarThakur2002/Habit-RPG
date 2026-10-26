import { syncRefusalSchema, type SyncRequest } from '@habit-rpg/shared';
import {
  AuthError,
  FunctionsFetchError,
  FunctionsHttpError,
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { z } from 'zod';

import type { TransportResult } from '../sync/engine';

import { largeSecureStore } from './large-secure-store';

// The only place the app talks to Supabase (CLAUDE.md). Only the project URL and the
// publishable key ship in the app; Row Level Security protects the data (SCOPE.md section 9.6).

const configSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

// Named explicitly so signing out can clear it even when the server can't be reached.
const SESSION_KEY = 'habit-rpg-session';

let client: SupabaseClient | null | undefined;

/**
 * The shared client, or null when this build has no Supabase settings (a fresh clone without
 * apps/mobile/.env, or CI). The game itself never needs the network, so that is not an error.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = configSchema.safeParse({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!config.success) {
    console.warn('Supabase is not configured; email sign-in is off', config.error.issues);
    client = null;
    return client;
  }
  client = createClient(config.data.url, config.data.publishableKey, {
    auth: {
      storage: largeSecureStore,
      storageKey: SESSION_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Refresh tokens only while the app is in front, as Supabase recommends for React Native.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void client?.auth.startAutoRefresh();
    else void client?.auth.stopAutoRefresh();
  });
  return client;
}

export type AuthResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** What the player sees when an auth call fails; unexpected errors are also logged. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code === 'otp_expired' || error.code === 'invalid_credentials') {
      return 'That code is wrong or has expired. Check it, or ask for a new one.';
    }
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return 'Too many codes asked for. Wait a minute and try again.';
    }
    if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
      return "Can't reach the server. Check your connection and try again.";
    }
  }
  console.warn('Unexpected sign-in error', error);
  return 'Something went wrong. Try again.';
}

const NOT_CONFIGURED: AuthResult<never> = {
  ok: false,
  message: "Email sign-in isn't set up in this build. You can still play without an account.",
};

async function run<T>(call: (supabase: SupabaseClient) => Promise<T>): Promise<AuthResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    return { ok: true, value: await call(supabase) };
  } catch (error: unknown) {
    return { ok: false, message: authErrorMessage(error) };
  }
}

/** Emails a 6-digit code; a new email creates the account (SCOPE.md section 9.5). */
export function sendCode(email: string): Promise<AuthResult<null>> {
  return run(async (supabase) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return null;
  });
}

export interface SignedInUser {
  id: string;
  email: string;
}

/** Checks the code; on success supabase-js keeps the session in largeSecureStore. */
export function verifyCode(email: string, code: string): Promise<AuthResult<SignedInUser>> {
  return run(async (supabase) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    if (!data.user) throw new Error('verifyOtp returned no user');
    return { id: data.user.id, email: data.user.email ?? email };
  });
}

/**
 * Forgets the session on this phone; `scope: 'local'` leaves other devices signed in. If the
 * server can't be reached, supabase-js keeps the stored session, so it is removed here: being
 * offline must never stop a player from signing out.
 */
export async function signOutLocally(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    console.warn('Signing out on the server failed; removing the session on this phone', error);
    await largeSecureStore.removeItem(SESSION_KEY);
  }
}

/** What the player sees when deleting the account fails; nothing is deleted on the phone. */
export function deleteErrorMessage(error: unknown): string {
  if (error instanceof FunctionsFetchError) {
    return 'You need to be online to do this. Nothing was deleted.';
  }
  console.warn('Deleting the account failed', error);
  return "Your account couldn't be deleted. Try again.";
}

/**
 * Deletes the account and everything in it on the server (SCOPE.md F10), with the session's
 * token saying whose. It needs the network; the caller then clears this phone.
 */
export async function deleteAccount(): Promise<AuthResult<null>> {
  const supabase = getSupabase();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  return error ? { ok: false, message: deleteErrorMessage(error) } : { ok: true, value: null };
}

/** How a failed `sync` call is retried: no answer and 5xx are, a 4xx isn't (D46). */
export function syncFailure(error: unknown): Failure {
  if (error instanceof FunctionsFetchError) {
    return { ok: false, kind: 'offline', message: "Can't reach the server" };
  }
  const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0;
  if (status >= 400 && status < 500) {
    return {
      ok: false,
      kind: 'refused',
      status,
      message: `The server refused the sync (${status})`,
    };
  }
  console.warn('sync failed', error);
  return { ok: false, kind: 'server', status, message: 'The server had a problem' };
}

type Failure = Extract<TransportResult, { ok: false }>;

/**
 * Adds what a refusal's body says: the server's code, and with `hero_exists` the account's
 * hero, which the two-heroes choice shows (D49). A body that doesn't parse adds nothing.
 */
export function withRefusal(failure: Failure, body: unknown): Failure {
  const parsed = syncRefusalSchema.safeParse(body);
  if (!parsed.success) return failure;
  const { error: code, hero } = parsed.data;
  return { ...failure, code, ...(hero ? { hero } : {}) };
}

/** The sync engine's transport: one POST to the `sync` Edge Function with the session's token. */
export async function sendSync(request: SyncRequest): Promise<TransportResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, kind: 'refused', message: "Sync isn't set up in this build" };
  const { data, error } = await supabase.functions.invoke('sync', { body: request });
  if (!error) return { ok: true, body: data };
  const failure = syncFailure(error);
  // A refusal says why in its body, e.g. `hero_exists` when the account already has a hero.
  if (failure.kind === 'refused' && error instanceof FunctionsHttpError) {
    return withRefusal(failure, await (error.context as Response).json().catch(() => null));
  }
  return failure;
}
