/**
 * Formatting helpers. Timestamps are shown as the exact local scan time
 * (brief Section 7.6: e.g. "14:32:07").
 */

export function formatScanTime(isoString: string): string {
  const date = new Date(isoString);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
