import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import { env } from './env';
import { secureStorage } from './secureStorage';

/**
 * Single Supabase client for the app (brief Section 6). Sessions persist in the
 * OS keychain via the chunked SecureStore adapter; tokens auto-refresh.
 *
 * Components never import this directly — all access goes through typed wrappers
 * in src/features/* (brief Section 12 conventions).
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection in a native app (no redirect callback).
      detectSessionInUrl: false,
    },
  },
);

// Drive token auto-refresh off app foreground/background. Supabase recommends
// pausing the refresh timer while backgrounded and resuming on foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
