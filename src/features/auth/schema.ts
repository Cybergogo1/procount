import { z } from 'zod';

/** Validation for the auth forms (brief Section 4 + react-hook-form/zod stack). */

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  // Supabase default minimum is 6; keep the client rule in step with it.
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
