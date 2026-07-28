/**
 * Typed access to the public runtime config. EXPO_PUBLIC_* vars are inlined
 * into the bundle at build time (brief Section 14). Missing values surface as a
 * clear error at startup rather than an opaque failure deep in a network call.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  // RevenueCat keys are read lazily in src/lib/revenuecat.ts (Section 10) so the
  // app still boots in environments where only Supabase is configured.
} as const;
