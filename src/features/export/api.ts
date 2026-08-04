import { supabase } from '@/lib/supabase';

/** Export format (brief Section 9). Excel is the default. */
export type ExportFormat = 'csv' | 'xlsx';

/**
 * Record the recipient email on the session so the Edge Function can read it.
 * The session stays **active** and its scans are kept — exporting no longer ends
 * the count (client request), so the user returns to their session afterwards
 * and can re-export or keep adding items.
 */
export async function setSessionExportEmail(
  sessionId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ export_email: email })
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * Invoke the send-session-report Edge Function (brief Section 9, steps 3–4).
 * The user's JWT is attached automatically by supabase-js.
 *
 * On a non-2xx response supabase-js throws a generic FunctionsHttpError; we dig
 * the function's own `{ error }` message out of the attached Response so the
 * user (and the logs) see the real reason instead of "non-2xx status code".
 */
export async function requestSessionReport(
  sessionId: string,
  format: ExportFormat,
  combine: boolean,
): Promise<void> {
  // Send the device's IANA time zone so the export's timestamps are formatted to
  // match the wall clock at the location being counted (brief: local device time).
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { error } = await supabase.functions.invoke('send-session-report', {
    body: { session_id: sessionId, format, time_zone: timeZone, combine },
  });
  if (!error) return;

  let detail = error.message;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = await context.json();
      if (body && typeof body.error === 'string') detail = body.error;
    } catch {
      // Response wasn't JSON — fall back to the generic message.
    }
  }
  throw new Error(detail);
}
