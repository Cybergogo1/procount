import { supabase } from '@/lib/supabase';

/**
 * Auth wrappers (brief Section 6: email + password only for V1).
 * Components call these instead of touching the Supabase client directly.
 */

export type AuthCredentials = {
  email: string;
  password: string;
};

/**
 * Register a new user. The `handle_new_user` trigger creates the profile row
 * and stamps trial_started_at (brief Section 5). Supabase is configured to
 * require email confirmation before first sign-in (Section 6), so a successful
 * sign-up returns a user but no active session until the email is confirmed.
 */
export async function signUp({ email, password }: AuthCredentials) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // session is null when email confirmation is pending.
  return { user: data.user, needsConfirmation: data.session === null };
}

export async function signIn({ email, password }: AuthCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
