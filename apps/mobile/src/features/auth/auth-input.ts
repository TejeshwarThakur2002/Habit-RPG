import { z } from 'zod';

// Validated on the phone before anything is sent; Supabase checks again on the server.

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter an email like you@example.com'));

/** The 6-digit code from the email (SCOPE.md section 9.5). */
export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6 digits from the email');

export const CODE_LENGTH = 6;
/** "Resend in 30 s" (SCOPE.md section 5.8). */
export const RESEND_SECONDS = 30;
