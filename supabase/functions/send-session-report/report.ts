import { encodeBase64, XLSX } from './deps.ts';

/**
 * Report generation for a session export (brief Section 9 + client requests).
 * Pure functions — no Supabase or network — so they can be unit-tested directly.
 *
 * Two shapes:
 *  - Separated (default): one row per scan, with the local-time timestamp, the
 *    calculator expression, and a Duplicate flag ("Y" when the barcode was
 *    scanned more than once) — the raw count for verification.
 *  - Combined: one row per barcode, quantities summed, plus how many times each
 *    item was counted — the summary view.
 *
 * Scans are stored in UTC; timestamps are formatted in the auditing device's
 * time zone (an IANA name like "Europe/London") so they match the wall clock.
 */

export type ReportFormat = 'csv' | 'xlsx';

export type ReportScan = {
  barcode: string;
  quantity: number;
  /** The +/× calculator expression behind the quantity (may be null/plain). */
  expression: string | null;
  /** ISO timestamp (UTC) of when the scan happened. */
  scanned_at: string;
};

export type GeneratedReport = {
  filename: string;
  contentType: string;
  /** Base64-encoded file contents (ready for a Resend attachment). */
  base64: string;
};

type Cell = string | number;
type Matrix = Cell[][];

/** Format a UTC ISO timestamp as "YYYY-MM-DD HH:MM:SS" in the given time zone. */
export function formatTimestamp(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return (
    `${part('year')}-${part('month')}-${part('day')} ` +
    `${part('hour')}:${part('minute')}:${part('second')}`
  );
}

/** "YYYY-MM-DD" for the export date in the given time zone (filename stamp). */
export function localDateStamp(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Separated: one row per scan, with a Duplicate flag. */
export function separatedMatrix(scans: ReportScan[], timeZone: string): Matrix {
  const counts = new Map<string, number>();
  for (const scan of scans) {
    counts.set(scan.barcode, (counts.get(scan.barcode) ?? 0) + 1);
  }

  const header: Cell[] = [
    'Barcode',
    'Quantity',
    'Calculation',
    `Timestamp (${timeZone})`,
    'Duplicate',
  ];
  const rows: Matrix = scans.map((scan) => [
    scan.barcode,
    scan.quantity,
    scan.expression ?? '',
    formatTimestamp(scan.scanned_at, timeZone),
    (counts.get(scan.barcode) ?? 0) > 1 ? 'Y' : '',
  ]);
  return [header, ...rows];
}

/** Combined: one row per barcode, summed, with a count of scans. */
export function combinedMatrix(scans: ReportScan[]): Matrix {
  const order: string[] = [];
  const totals = new Map<string, { quantity: number; times: number }>();
  for (const scan of scans) {
    let entry = totals.get(scan.barcode);
    if (!entry) {
      entry = { quantity: 0, times: 0 };
      totals.set(scan.barcode, entry);
      order.push(scan.barcode);
    }
    entry.quantity += scan.quantity;
    entry.times += 1;
  }

  const header: Cell[] = ['Barcode', 'Quantity', 'Times counted'];
  const rows: Matrix = order.map((barcode) => {
    const entry = totals.get(barcode)!;
    return [barcode, entry.quantity, entry.times];
  });
  return [header, ...rows];
}

function buildMatrix(
  scans: ReportScan[],
  timeZone: string,
  combine: boolean,
): Matrix {
  return combine ? combinedMatrix(scans) : separatedMatrix(scans, timeZone);
}

/** RFC-4180-style CSV field escaping. */
function escapeCsv(value: Cell): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function matrixToCsv(matrix: Matrix): string {
  return (
    matrix.map((row) => row.map(escapeCsv).join(',')).join('\r\n') + '\r\n'
  );
}

function matrixToXlsx(matrix: Matrix): Uint8Array {
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ProCount');
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
}

/** Build the attachment for the requested format and layout. */
export function buildReport(
  scans: ReportScan[],
  format: ReportFormat,
  opts: { timeZone: string; date: Date; combine: boolean },
): GeneratedReport {
  const matrix = buildMatrix(scans, opts.timeZone, opts.combine);
  const stamp = localDateStamp(opts.date, opts.timeZone);

  if (format === 'csv') {
    return {
      filename: `procount-${stamp}.csv`,
      contentType: 'text/csv',
      base64: encodeBase64(new TextEncoder().encode(matrixToCsv(matrix))),
    };
  }

  return {
    filename: `procount-${stamp}.xlsx`,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: encodeBase64(matrixToXlsx(matrix)),
  };
}
