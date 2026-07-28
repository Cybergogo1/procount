import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { XLSX } from './deps.ts';
import {
  buildReport,
  combinedMatrix,
  formatTimestamp,
  localDateStamp,
  separatedMatrix,
  type ReportScan,
} from './report.ts';
import { deliverReport, reportSubject } from './delivery.ts';
import type { EmailMessage } from './mailer.ts';

const SCANS: ReportScan[] = [
  {
    barcode: '5012345678900',
    quantity: 730,
    expression: '12×12×5+10',
    scanned_at: '2026-06-16T14:32:07.000Z',
  },
  {
    barcode: '4006381333931',
    quantity: 1,
    expression: null,
    scanned_at: '2026-06-16T14:33:10.000Z',
  },
  // Same barcode as the first scan -> both should be flagged Duplicate.
  {
    barcode: '5012345678900',
    quantity: 27,
    expression: '6+6+6+6+3',
    scanned_at: '2026-06-16T14:40:00.000Z',
  },
];

Deno.test('formatTimestamp: renders YYYY-MM-DD HH:MM:SS in the given zone', () => {
  assertEquals(formatTimestamp('2026-06-16T14:32:07.000Z', 'UTC'), '2026-06-16 14:32:07');
  assertEquals(
    formatTimestamp('2026-06-16T14:32:07.000Z', 'America/New_York'),
    '2026-06-16 10:32:07',
  );
  assertEquals(
    formatTimestamp('2026-06-16T14:32:07.000Z', 'Australia/Sydney'),
    '2026-06-17 00:32:07',
  );
});

Deno.test('localDateStamp: date in the given zone', () => {
  assertEquals(localDateStamp(new Date('2026-06-16T23:30:00.000Z'), 'Australia/Sydney'), '2026-06-17');
  assertEquals(localDateStamp(new Date('2026-06-16T23:30:00.000Z'), 'UTC'), '2026-06-16');
});

Deno.test('separatedMatrix: one row per scan, with Duplicate flag', () => {
  const matrix = separatedMatrix(SCANS, 'UTC');
  assertEquals(matrix[0], [
    'Barcode',
    'Quantity',
    'Calculation',
    'Timestamp (UTC)',
    'Duplicate',
  ]);
  // First + third share a barcode -> both 'Y'; the unique one is blank.
  assertEquals(matrix[1], ['5012345678900', 730, '12×12×5+10', '2026-06-16 14:32:07', 'Y']);
  assertEquals(matrix[2], ['4006381333931', 1, '', '2026-06-16 14:33:10', '']);
  assertEquals(matrix[3], ['5012345678900', 27, '6+6+6+6+3', '2026-06-16 14:40:00', 'Y']);
});

Deno.test('combinedMatrix: one row per barcode, summed + times counted', () => {
  const matrix = combinedMatrix(SCANS);
  assertEquals(matrix[0], ['Barcode', 'Quantity', 'Times counted']);
  // 730 + 27 across two scans.
  assertEquals(matrix[1], ['5012345678900', 757, 2]);
  assertEquals(matrix[2], ['4006381333931', 1, 1]);
  assertEquals(matrix.length, 3); // header + 2 unique barcodes
});

Deno.test('buildReport: separated csv escapes the zone header + flags duplicates', () => {
  const report = buildReport(SCANS, 'csv', {
    timeZone: 'UTC',
    date: new Date('2026-06-16T12:00:00.000Z'),
    combine: false,
  });
  assertEquals(report.filename, 'procount-2026-06-16.csv');

  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(report.base64), (c) => c.charCodeAt(0)),
  );
  assertStringIncludes(decoded, 'Barcode,Quantity,Calculation,Timestamp (UTC),Duplicate');
  assertStringIncludes(decoded, '5012345678900,730,12×12×5+10,2026-06-16 14:32:07,Y');
  assertStringIncludes(decoded, '4006381333931,1,,2026-06-16 14:33:10,');
});

Deno.test('buildReport: combined xlsx sums per barcode', () => {
  const report = buildReport(SCANS, 'xlsx', {
    timeZone: 'UTC',
    date: new Date('2026-06-16T12:00:00.000Z'),
    combine: true,
  });
  const workbook = XLSX.read(
    Uint8Array.from(atob(report.base64), (c) => c.charCodeAt(0)),
    { type: 'array' },
  );
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
  assertEquals(rows[0], ['Barcode', 'Quantity', 'Times counted']);
  assertEquals(rows[1], ['5012345678900', 757, 2]);
});

Deno.test('reportSubject: human-readable date in the zone', () => {
  assertEquals(
    reportSubject(new Date('2026-06-16T12:00:00.000Z'), 'UTC'),
    'ProCount session — 16 Jun 2026',
  );
});

Deno.test('deliverReport: separated send shape', async () => {
  const sent: EmailMessage[] = [];
  await deliverReport({
    to: 'manager@store.example',
    scans: SCANS,
    format: 'csv',
    fromEmail: 'reports@procount.app',
    date: new Date('2026-06-16T12:00:00.000Z'),
    timeZone: 'Europe/London',
    combine: false,
    send: async (message) => {
      sent.push(message);
    },
  });

  assertEquals(sent.length, 1);
  const message = sent[0];
  assertEquals(message.to, 'manager@store.example');
  assertEquals(message.subject, 'ProCount session — 16 Jun 2026');
  assertEquals(message.attachments[0].filename, 'procount-2026-06-16.csv');
  assertStringIncludes(message.text, '3 line items');
  assertStringIncludes(message.text, '758 items'); // 730 + 1 + 27
  assertStringIncludes(message.text, 'One row per scan');

  // London is UTC+1 in June (BST) -> 14:33:10Z becomes 15:33:10; null expr -> ''.
  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(message.attachments[0].content), (c) => c.charCodeAt(0)),
  );
  assertStringIncludes(decoded, '4006381333931,1,,2026-06-16 15:33:10,');
});

Deno.test('deliverReport: combined notes the layout', async () => {
  const sent: EmailMessage[] = [];
  await deliverReport({
    to: 'manager@store.example',
    scans: SCANS,
    format: 'csv',
    fromEmail: 'reports@procount.app',
    date: new Date('2026-06-16T12:00:00.000Z'),
    timeZone: 'UTC',
    combine: true,
    send: async (message) => {
      sent.push(message);
    },
  });
  assertStringIncludes(sent[0].text, 'combined');
});

Deno.test('deliverReport: surfaces a failing send', async () => {
  let threw = false;
  try {
    await deliverReport({
      to: 'manager@store.example',
      scans: SCANS,
      format: 'xlsx',
      fromEmail: 'reports@procount.app',
      date: new Date('2026-06-16T12:00:00.000Z'),
      timeZone: 'UTC',
      combine: false,
      send: async () => {
        throw new Error('boom');
      },
    });
  } catch {
    threw = true;
  }
  assert(threw);
});
