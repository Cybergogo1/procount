import { createClient } from './deps.ts';
import { deliverReport } from './delivery.ts';
import { resendSender } from './mailer.ts';
import type { ReportFormat, ReportScan } from './report.ts';

/**
 * send-session-report (brief Section 9).
 *
 * Loads a session and its scans (as the authenticated user, so RLS applies),
 * generates a CSV or XLSX report, emails it via Resend to the address the
 * client stored on the session, then stamps `exported_at`.
 *
 * Secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY      — Resend API key
 *   REPORT_FROM_EMAIL   — sender address (defaults to reports@procount.app)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Validate an IANA time zone string; fall back to UTC if absent/invalid. */
function resolveTimeZone(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  let body: {
    session_id?: string;
    format?: ReportFormat;
    time_zone?: string;
    combine?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const sessionId = body.session_id;
  const format: ReportFormat = body.format === 'csv' ? 'csv' : 'xlsx';
  const timeZone = resolveTimeZone(body.time_zone);
  const combine = body.combine === true;
  if (!sessionId) {
    return json({ error: 'session_id is required' }, 400);
  }

  // Client scoped to the caller's JWT so row-level security is enforced.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const sessionResult = await supabase
    .from('sessions')
    .select('id, export_email, ended_at, name')
    .eq('id', sessionId)
    .single();

  if (sessionResult.error || !sessionResult.data) {
    return json({ error: 'Session not found' }, 404);
  }
  const session = sessionResult.data as {
    id: string;
    export_email: string | null;
    ended_at: string | null;
    name: string | null;
  };

  if (!session.export_email) {
    return json({ error: 'Session has no export email set' }, 400);
  }

  const scansResult = await supabase
    .from('scans')
    .select('barcode, quantity, expression, scanned_at')
    .eq('session_id', sessionId)
    .order('scanned_at', { ascending: true });

  if (scansResult.error) {
    return json({ error: 'Could not load scans' }, 500);
  }
  const scans = (scansResult.data ?? []) as ReportScan[];

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return json({ error: 'Email service not configured' }, 500);
  }
  const fromEmail = Deno.env.get('REPORT_FROM_EMAIL') ?? 'reports@procount.app';

  try {
    await deliverReport({
      to: session.export_email,
      scans,
      format,
      fromEmail,
      date: session.ended_at ? new Date(session.ended_at) : new Date(),
      timeZone,
      combine,
      sessionName: session.name,
      send: resendSender(apiKey),
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Failed to send report' },
      502,
    );
  }

  // Stamp the successful export (brief: function sets exported_at).
  await supabase
    .from('sessions')
    .update({ exported_at: new Date().toISOString() })
    .eq('id', sessionId);

  return json({ ok: true, lineItems: scans.length });
});
