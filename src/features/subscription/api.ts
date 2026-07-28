import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

/** Load the user's profile row, which carries the trial start (brief Section 10). */
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
