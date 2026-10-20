// Text other players can see (hero names, habit names in the battle log) is tidied and
// stripped of control and invisible characters (SCOPE.md section 9.6).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

export function cleanText(raw: string): string {
  // Whitespace first, so a newline between words becomes a space rather than vanishing.
  return raw.replace(/\s+/g, ' ').replace(CONTROL_CHARS, '').trim();
}
