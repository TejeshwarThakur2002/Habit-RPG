import { z } from 'zod';

// SCOPE.md F1: hero name 2 to 20 characters. Section 9.6: hero names are shown to party
// members, so control characters are stripped and whitespace is tidied first.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

export function cleanHeroName(raw: string): string {
  // Whitespace first, so a newline between words becomes a space rather than vanishing.
  return raw.replace(/\s+/g, ' ').replace(CONTROL_CHARS, '').trim();
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone.length > 0;
  } catch {
    return false;
  }
}

export const heroNameSchema = z
  .string()
  .transform(cleanHeroName)
  .pipe(z.string().min(2, 'Use at least 2 characters').max(20, 'Use at most 20 characters'));

export const timeZoneSchema = z
  .string()
  .trim()
  .refine(isValidTimeZone, 'Enter a time zone like America/Toronto');

export const heroInputSchema = z.object({
  heroName: heroNameSchema,
  heroClass: z.enum(['knight', 'mage', 'rogue']),
  timeZone: timeZoneSchema,
});

export type HeroInput = z.infer<typeof heroInputSchema>;

/** The first error message for a field, or null when it is valid. */
export function fieldError(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Not valid');
}
