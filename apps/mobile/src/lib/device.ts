import * as Crypto from 'expo-crypto';

/** New row ids are UUIDs made on the device, so rows can be created offline (section 8.1). */
export function newId(): string {
  return Crypto.randomUUID();
}

/** The phone's IANA time zone, e.g. 'America/Toronto', used to pre-fill onboarding. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}
