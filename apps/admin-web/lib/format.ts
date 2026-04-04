/**
 * Format paise as INR (e.g. 10000 -> "₹100.00")
 */
export function formatMoney(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(iso));
}

/** Pickup banner: "04 April 2026" (local calendar day from ISO). */
export function formatPickupDayDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(d);
  return `${day} ${month} ${d.getFullYear()}`;
}

/** Normalize a single clock like "9:30", "13:00", or "1:30 pm" to "HH:MM" 24-hour. */
function normalizeClockTo24h(part: string): string | null {
  const t = part.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(a\.?m\.?|p\.?m\.?))?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2].padStart(2, '0');
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (ap && (h < 0 || h > 23)) return null;
  if (!ap && (h < 0 || h > 23)) return null;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * Format slot string (e.g. "13:00-15:00") as 24-hour "13:00–15:00".
 * Falls back to original string if parsing fails.
 */
export function formatTimeWindow24h(timeWindow: string): string {
  const raw = (timeWindow ?? '').trim();
  if (!raw) return '';
  const chunks = raw.split(/\s*-\s*/);
  if (chunks.length === 2) {
    const a = normalizeClockTo24h(chunks[0]);
    const b = normalizeClockTo24h(chunks[1]);
    if (a && b) return `${a}–${b}`;
  }
  const single = normalizeClockTo24h(raw);
  return single ?? raw;
}

/**
 * Return YYYY-MM-DD for the **local** calendar date of an ISO timestamp.
 * Use this when grouping or filtering by "day" so UTC timestamps (e.g. 25 Feb 03:39 IST = 24 Feb 22:09 UTC)
 * show under the correct local date (25th), not the UTC date (24th).
 */
export function isoToLocalDateKey(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD in local timezone (for default values and ranges). */
export function getTodayLocalDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * Return the Google Maps URL stored on the address (from mobile app).
 * We do NOT convert address text to a maps search – just trust the saved link.
 */
export function getGoogleMapsUrl(googleMapUrl?: string | null): string {
  const url = (googleMapUrl ?? '').trim();
  if (!url) return '';
  return url;
}

/**
 * Digits-only for wa.me links (no + prefix).
 * 10-digit numbers are treated as India mobile and prefixed with 91.
 */
export function phoneDigitsForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  let d = phone.replace(/\D/g, '');
  if (d.length === 0) return null;
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d;
}
