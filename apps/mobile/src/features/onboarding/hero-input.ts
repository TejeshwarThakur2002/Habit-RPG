import { z } from 'zod';

import { cleanText, isValidTimeZone } from '@habit-rpg/shared';

// SCOPE.md F1: hero name 2 to 20 characters, after cleanText (section 9.6).

export const heroNameSchema = z
  .string()
  .transform(cleanText)
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
