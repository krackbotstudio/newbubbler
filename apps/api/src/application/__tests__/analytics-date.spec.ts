/**
 * Analytics date presets produce correct ranges (including FY boundaries).
 */
import { getRevenueDateRange, getRevenueDateRangeCustom } from '../time/analytics-date';

describe('Analytics date presets', () => {
  // Fixed "now": 15 June 2025 in India
  const now = new Date(Date.UTC(2025, 5, 15, 10, 30, 0) - 5.5 * 60 * 60 * 1000);

  it('TODAY returns one full India day range', () => {
    const r = getRevenueDateRange('TODAY', now);
    expect(r.breakdownKind).toBe('daily');
    const ms = r.dateTo.getTime() - r.dateFrom.getTime();
    expect(ms).toBe(24 * 60 * 60 * 1000);
  });

  it('THIS_MONTH returns a range within current month', () => {
    const r = getRevenueDateRange('THIS_MONTH', now);
    expect(r.dateTo.getTime()).toBeGreaterThan(r.dateFrom.getTime());
    expect(r.breakdownKind).toBe('daily');
  });

  it('LAST_YEAR returns full previous calendar year', () => {
    const r = getRevenueDateRange('LAST_YEAR', now);
    expect(r.dateFrom.getUTCFullYear()).toBe(2024);
    expect(r.dateTo.getUTCFullYear()).toBe(2024);
    expect(r.dateTo.getTime()).toBeGreaterThan(r.dateFrom.getTime());
    expect(r.breakdownKind).toBe('monthly');
  });

  it('FY25 returns Apr 1 2025 to Mar 31 2026', () => {
    const r = getRevenueDateRange('FY25');
    expect(r.dateFrom.getUTCFullYear()).toBe(2025);
    expect(r.dateFrom.getUTCMonth()).toBe(3);
    expect(r.dateFrom.getUTCDate()).toBe(1);
    expect(r.dateTo.getUTCFullYear()).toBe(2026);
    expect(r.dateTo.getUTCMonth()).toBe(2);
    expect(r.dateTo.getUTCDate()).toBe(31);
    expect(r.breakdownKind).toBe('monthly');
  });

  it('FY26 returns Apr 1 2026 to Mar 31 2027', () => {
    const r = getRevenueDateRange('FY26');
    expect(r.dateFrom.getUTCFullYear()).toBe(2026);
    expect(r.dateFrom.getUTCMonth()).toBe(3);
    expect(r.dateFrom.getUTCDate()).toBe(1);
    expect(r.dateTo.getUTCFullYear()).toBe(2027);
    expect(r.dateTo.getUTCMonth()).toBe(2);
    expect(r.dateTo.getUTCDate()).toBe(31);
  });

  it('custom range throws when dateFrom > dateTo', () => {
    const from = new Date('2025-06-01');
    const to = new Date('2025-05-01');
    expect(() => getRevenueDateRangeCustom(from, to)).toThrow('ANALYTICS_INVALID_RANGE');
  });

  it('custom range returns daily breakdown for <= 92 days', () => {
    const from = new Date('2025-06-01');
    const to = new Date('2025-06-15');
    const r = getRevenueDateRangeCustom(from, to);
    expect(r.breakdownKind).toBe('daily');
  });

  it('custom range returns monthly breakdown for > 92 days', () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-06-30');
    const r = getRevenueDateRangeCustom(from, to);
    expect(r.breakdownKind).toBe('monthly');
  });
});
