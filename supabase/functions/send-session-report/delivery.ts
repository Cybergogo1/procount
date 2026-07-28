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
  send: SendEmail;
};

/** "ProCount session — 16 Jun 2026" in the device's time zone. */
export function reportSubject(date: Date, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return `ProCount session — ${formatted}`;
}

export async function deliverReport({
  to,
  scans,
  format,
  fromEmail,
  date,
  timeZone,
  combine,
  send,
}: DeliverReportInput): Promise<void> {
  const report = buildReport(scans, format, { timeZone, date, combine });
  const totalItems = scans.reduce((sum, s) => sum + s.quantity, 0);
  const layoutLine = combine
    ? 'Like items are combined into one row each.'
    : `One row per scan. Timestamps are in ${timeZone}.`;

  await send({
    from: fromEmail,
    to,
    subject: reportSubject(date, timeZone),
    text:
      `Your ProCount inventory count is attached.\n\n` +
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
