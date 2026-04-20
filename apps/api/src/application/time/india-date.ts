const INDIA_OFFSET_MINUTES = 5.5 * 60;
const MS_PER_MINUTE = 60 * 1000;

function toIndiaDate(date: Date): Date {
  const utcMs = date.getTime();
  const indiaMs = utcMs + INDIA_OFFSET_MINUTES * MS_PER_MINUTE;
  return new Date(indiaMs);
}

export function toIndiaDateKey(date: Date): string {
  const india = toIndiaDate(date);
  const y = india.getUTCFullYear();
  const m = String(india.getUTCMonth() + 1).padStart(2, '0');
  const d = String(india.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function indiaDayRange(key: string): { start: Date; end: Date } {
  const [yStr, mStr, dStr] = key.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const d = Number(dStr);
  const start = new Date(Date.UTC(y, m, d));
  const end = new Date(Date.UTC(y, m, d + 1));
  return { start, end };
}

const INDIA_OFFSET_MS = INDIA_OFFSET_MINUTES * MS_PER_MINUTE;

/** UTC range for a full India calendar day (00:00–23:59 India). Use for counting orders "that day" in India. */
export function indiaDayUtcRange(key: string): { start: Date; end: Date } {
  const [yStr, mStr, dStr] = key.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const d = Number(dStr);
  const utcMidnight = Date.UTC(y, m, d);
  const start = new Date(utcMidnight - INDIA_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Format date key YYYY-MM-DD as DDMMYYYY for order numbers. */
export function dateKeyToDdMmYyyy(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}${m}${y}`;
}

/** DD, MM, YY (2-digit year) for human-readable order ids (India calendar day key). */
export function dateKeyToDdMmYy(key: string): { dd: string; mm: string; yy: string } {
  const [y, m, d] = key.split('-');
  const yy = (y ?? '2000').slice(-2).padStart(2, '0');
  return {
    dd: (d ?? '01').padStart(2, '0'),
    mm: (m ?? '01').padStart(2, '0'),
    yy,
  };
}

