// Centralised imports for the Edge Function (Deno runtime). Pinning here keeps
// versions consistent across the handler, report generator and tests.
export { createClient } from 'jsr:@supabase/supabase-js@2';
export type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
export * as XLSX from 'npm:xlsx@0.18.5';
export { encodeBase64 } from 'jsr:@std/encoding@1/base64';
