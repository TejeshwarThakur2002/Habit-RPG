// Text rules shared by the app and the Edge Functions, so a name is cleaned and checked the
// same way on both sides (SCOPE.md section 9.6).

// Text other players can see (hero names, habit names in the battle log) is tidied and
// stripped of control and invisible characters.
// Matching control characters is the point here: they are what gets removed.
// deno-lint-ignore no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

export function cleanText(raw: string): string {
  // Whitespace first, so a newline between words becomes a space rather than vanishing.
  return raw.replace(/\s+/g, ' ').replace(CONTROL_CHARS, '').trim();
}

/** An IANA time zone the platform knows, e.g. 'America/Toronto'. */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone.length > 0;
  } catch {
    return false;
  }
}
