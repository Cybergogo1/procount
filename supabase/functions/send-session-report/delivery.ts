import { buildReport, type ReportFormat, type ReportScan } from './report.ts';
import type { SendEmail } from './mailer.ts';

/**
 * Compose and send a session report (brief Section 9). Kept free of Supabase
 * and Deno globals so it can be unit-tested with a mocked `send`. All dates are
 * rendered in the auditing device's time zone.
 */

export type DeliverReportInput = {
  to: string;
  scans: ReportScan[];
  format: ReportFormat;
  fromEmail: string;
  /** Session date used in the subject and filename. */
  date: Date;
  /** IANA time zone of the auditing device (e.g. "Europe/London"). */
  timeZone: string;
  /** Combine like items into one row per barcode (vs one row per scan). */
  combine: boolean;
  /** Optional user-given name for the count (client request). */
  sessionName?: string | null;
  send: SendEmail;
};

/**
 * "ProCount session — 16 Jun 2026", or "ProCount session — Aisle 4 — 16 Jun
 * 2026" when the count was named (client request).
 */
export function reportSubject(
  date: Date,
  timeZone: string,
  sessionName?: string | null,
): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const name = sessionName?.trim();
  return name
    ? `ProCount session — ${name} — ${formatted}`
    : `ProCount session — ${formatted}`;
}

export async function deliverReport({
  to,
  scans,
  format,
  fromEmail,
  date,
  timeZone,
  combine,
  sessionName,
  send,
}: DeliverReportInput): Promise<void> {
  const report = buildReport(scans, format, {
    timeZone,
    date,
    combine,
    name: sessionName,
  });
  const totalItems = scans.reduce((sum, s) => sum + s.quantity, 0);
  const name = sessionName?.trim();
  const layoutLine = combine
    ? 'Like items are combined into one row each.'
    : `One row per scan. Timestamps are in ${timeZone}.`;

  await send({
    from: fromEmail,
    to,
    subject: reportSubject(date, timeZone, sessionName),
    text:
      `Your ProCount inventory count is attached.\n\n` +
      (name ? `Count: ${name}\n` : '') +
      `${scans.length} line item${scans.length === 1 ? '' : 's'}, ` +
      `${totalItems} item${totalItems === 1 ? '' : 's'} counted in total.\n` +
      layoutLine,
    attachments: [
      {
        filename: report.filename,
        content: report.base64,
        contentType: report.contentType,
      },
    ],
  });
}
