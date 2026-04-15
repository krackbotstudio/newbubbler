/**
 * Turn draft date inputs into values for API filters.
 * If both are set and "from" is after "to", swaps so the range is valid (user may pick either field first).
 */
export function normalizeDateRangeDraft(draftFrom: string, draftTo: string): { dateFrom: string; dateTo: string } {
  const f = draftFrom.trim();
  const t = draftTo.trim();
  if (!f && !t) return { dateFrom: '', dateTo: '' };
  if (f && t && f > t) return { dateFrom: t, dateTo: f };
  return { dateFrom: f, dateTo: t };
}
