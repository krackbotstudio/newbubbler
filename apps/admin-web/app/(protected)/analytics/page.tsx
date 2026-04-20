'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAnalyticsRevenue, useAnalyticsCompletedCatalogItems } from '@/hooks/useAnalytics';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { AnalyticsFilterBar, type BreakdownMode } from '@/components/admin/analytics/AnalyticsFilterBar';
import { RevenueKpis } from '@/components/admin/analytics/RevenueKpis';
import { RevenueLineChart } from '@/components/admin/analytics/RevenueLineChart';
import { RevenueBreakdownTable } from '@/components/admin/analytics/RevenueBreakdownTable';
import { OrderCategoriesPieChart } from '@/components/admin/analytics/OrderCategoriesPieChart';
import { AnalyticsOrdersList } from '@/components/admin/analytics/AnalyticsOrdersList';
import { CompletedCatalogItemsTable } from '@/components/admin/analytics/CompletedCatalogItemsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { toAnalyticsPoints, type AdminOrdersFilters } from '@/types';
import type { AnalyticsPreset, AnalyticsTotals } from '@/types';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { getStoredUser, isBranchFilterLocked, restrictBranchesForUser } from '@/lib/auth';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { normalizeDateRangeDraft } from '@/lib/normalize-applied-date-range';

const DEFAULT_PRESET: AnalyticsPreset = 'THIS_MONTH';

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ax = err as AxiosError<{ error?: string; message?: string }>;
    const msg = ax.response?.data?.error ?? ax.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
    return msg || 'Request failed';
  }
  return err instanceof Error ? err.message : 'Request failed';
}

function isInvalidRangeError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    const ax = err as AxiosError<{ error?: string; code?: string }>;
    const code = ax.response?.data?.code ?? ax.response?.data?.error ?? '';
    return String(code).toUpperCase().includes('ANALYTICS_INVALID_RANGE');
  }
  return false;
}

export default function AnalyticsPage() {
  const [selectedPreset, setSelectedPreset] = useState<AnalyticsPreset>(DEFAULT_PRESET);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('DAILY');
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const user = useMemo(() => getStoredUser(), []);
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const effectiveScopedBranchId = branchLocked ? user?.branchId ?? null : null;

  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const branchOptions = useMemo(() => restrictBranchesForUser(branches, user), [branches, user]);
  const isPartialAdmin = user?.role === 'PARTIAL_ADMIN';
  const [branchId, setBranchId] = useState<string>('');
  const effectiveBranchId = effectiveScopedBranchId ?? (branchId || null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const isCustom = selectedPreset === 'CUSTOM';
  const queryPreset = isCustom ? undefined : selectedPreset;
  const queryDateFrom = isCustom ? appliedDateFrom : undefined;
  const queryDateTo = isCustom ? appliedDateTo : undefined;
  const queryEnabled = !isCustom || (!!appliedDateFrom && !!appliedDateTo);

  const { data, isLoading, error } = useAnalyticsRevenue({
    preset: queryPreset,
    dateFrom: queryDateFrom || undefined,
    dateTo: queryDateTo || undefined,
    branchId: effectiveBranchId ?? undefined,
    enabled: queryEnabled,
  });
  const {
    data: completedCatalogItems = [],
    isLoading: completedCatalogLoading,
  } = useAnalyticsCompletedCatalogItems({
    preset: queryPreset,
    dateFrom: queryDateFrom || undefined,
    dateTo: queryDateTo || undefined,
    branchId: effectiveBranchId ?? undefined,
    enabled: queryEnabled,
  });

  // Orders: use same preset/custom range. For non-CUSTOM presets we derive dateFrom/dateTo keys client-side.
  const getIndiaDateRangeKeys = useCallback((preset: AnalyticsPreset): { dateFrom?: string; dateTo?: string } => {
    const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const t = new Date(now.getTime() + INDIA_OFFSET_MS);
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth();
    const d = t.getUTCDate();

    const toYMD = (dt: Date) => {
      const yy = dt.getUTCFullYear();
      const mm = dt.getUTCMonth() + 1;
      const dd = dt.getUTCDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${yy}-${pad(mm)}-${pad(dd)}`;
    };

    const mk = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));

    switch (preset) {
      case 'TODAY':
        return { dateFrom: toYMD(mk(y, m, d)), dateTo: toYMD(mk(y, m, d)) };
      case 'THIS_MONTH': {
        const start = mk(y, m, 1);
        const end = mk(y, m + 1, 0); // day 0 of next month = last day of current month
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'LAST_1_MONTH': {
        const start = mk(y, m - 1, 1);
        const end = mk(y, m, 0);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'LAST_3_MONTHS': {
        const start = mk(y, m - 2, 1);
        const end = mk(y, m, d);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'LAST_6_MONTHS': {
        const start = mk(y, m - 5, 1);
        const end = mk(y, m, d);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'LAST_12_MONTHS': {
        const start = mk(y - 1, m, d);
        const end = mk(y, m, d);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'THIS_YEAR': {
        const start = mk(y, 0, 1);
        const end = mk(y, m, d);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'LAST_YEAR': {
        const start = mk(y - 1, 0, 1);
        const end = mk(y - 1, 11, 31);
        return { dateFrom: toYMD(start), dateTo: toYMD(end) };
      }
      case 'FY25':
        return { dateFrom: toYMD(mk(2025, 3, 1)), dateTo: toYMD(mk(2026, 2, 31)) };
      case 'FY26':
        return { dateFrom: toYMD(mk(2026, 3, 1)), dateTo: toYMD(mk(2027, 2, 31)) };
      case 'FY27':
        return { dateFrom: toYMD(mk(2027, 3, 1)), dateTo: toYMD(mk(2028, 2, 31)) };
      default:
        return {};
    }
  }, []);

  const ordersDateRange = useMemo(() => {
    if (isCustom) {
      return { dateFrom: appliedDateFrom || undefined, dateTo: appliedDateTo || undefined };
    }
    return getIndiaDateRangeKeys(selectedPreset);
  }, [appliedDateFrom, appliedDateTo, getIndiaDateRangeKeys, isCustom, selectedPreset]);

  useEffect(() => {
    setCursor(undefined);
  }, [selectedPreset, appliedDateFrom, appliedDateTo, effectiveBranchId]);

  useEffect(() => {
    if (branchLocked || !isPartialAdmin || branchId) return;
    if (branchOptions.length > 0) setBranchId(branchOptions[0].id);
  }, [branchLocked, isPartialAdmin, branchId, branchOptions]);

  const limit = 20;
  const ordersFilters: AdminOrdersFilters = {
    branchId: effectiveBranchId ?? undefined,
    dateFrom: ordersDateRange.dateFrom,
    dateTo: ordersDateRange.dateTo,
    limit,
    cursor,
  };

  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    error: ordersError,
  } = useOrders(ordersFilters, { refetchInterval: 30000 });

  const orders = ordersResponse?.data ?? [];
  const ordersHasMore = Boolean(ordersResponse?.nextCursor);
  const ordersErrorMessage = ordersError ? (ordersError as Error).message : null;

  // If the revenue query is disabled because custom range isn't applied, still allow the order list to show latest data.
  // (Orders query already has sensible default ranges above.)

  useEffect(() => {
    if (!error) {
      setDateRangeError(null);
      return;
    }
    const msg = getErrorMessage(error);
    if (isInvalidRangeError(error)) {
      setDateRangeError(msg || 'Invalid date range');
      toast.error(msg || 'Invalid date range');
    } else {
      toast.error(msg);
    }
  }, [error]);

  useEffect(() => {
    setDateRangeError(null);
  }, [dateFrom, dateTo]);

  const handleApplyCustomRange = useCallback(() => {
    setDateRangeError(null);
    if (!dateFrom.trim() || !dateTo.trim()) {
      setDateRangeError('Please select both dates');
      return;
    }
    const n = normalizeDateRangeDraft(dateFrom, dateTo);
    setDateFrom(n.dateFrom);
    setDateTo(n.dateTo);
    setAppliedDateFrom(n.dateFrom);
    setAppliedDateTo(n.dateTo);
  }, [dateFrom, dateTo]);

  const handleResetToPreset = useCallback(() => {
    setSelectedPreset(DEFAULT_PRESET);
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setDateRangeError(null);
  }, []);

  const handlePresetChange = useCallback((p: AnalyticsPreset) => {
    setSelectedPreset(p);
    if (p !== 'CUSTOM') setDateRangeError(null);
  }, []);

  const totals: AnalyticsTotals | null = data
    ? {
        billedPaise: data.billedPaise,
        collectedPaise: data.collectedPaise,
        taxPaise: data.taxPaise,
        discountPaise: data.discountPaise,
        ordersCount: data.ordersCount,
        invoicesCount: data.invoicesCount,
      }
    : null;
  const points = data ? toAnalyticsPoints(data.breakdown) : [];
  const orderCategories = data?.orderCategories;

  const showCustomPrompt = isCustom && !appliedDateFrom && !appliedDateTo;
  const showDashboard = queryEnabled;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <AnalyticsFilterBar
        preset={selectedPreset}
        setPreset={handlePresetChange}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        mode={breakdownMode}
        setMode={setBreakdownMode}
        onApplyCustomRange={handleApplyCustomRange}
        onResetToPreset={handleResetToPreset}
        isLoading={isLoading}
        dateRangeError={dateRangeError ?? undefined}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          {branchLocked ? (
            <LockedBranchSelect branchId={user?.branchId} selectClassName="min-w-[220px]" />
          ) : (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[220px]"
              value={effectiveBranchId ?? ''}
              onChange={(e) => {
                setBranchId(e.target.value);
                setCursor(undefined);
              }}
              disabled={branchesLoading}
            >
              {!isPartialAdmin && <option value="">All branches</option>}
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {branchLocked ? (
          <div className="text-xs text-muted-foreground">
            Analytics for your assigned branch only.
          </div>
        ) : null}
      </div>

      {showCustomPrompt && (
        <EmptyState
          title="Select a custom range"
          description="Choose From and To dates, then click Apply."
        />
      )}

      {showDashboard && (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="w-full md:w-[360px]">
              <Card>
                <CardHeader>
                  <CardTitle>Orders breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderCategoriesPieChart isLoading={isLoading} categories={orderCategories} />
                </CardContent>
              </Card>
            </div>
            <div className="flex-1 min-w-0">
              <RevenueKpis totals={totals} isLoading={isLoading} />
            </div>
          </div>

          {!isLoading && !data && !error && (
            <EmptyState
              title="No data"
              description="Try a different preset or date range."
            />
          )}

          {(data || isLoading) && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <RevenueLineChart points={points} isLoading={isLoading} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <RevenueBreakdownTable
                    points={points}
                    isLoading={isLoading}
                    mode={breakdownMode}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branch orders (bill & invoice details)</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing current order status with bill total and ACK/Final issued times.
                  </p>
                </CardHeader>
                <CardContent>
                  <AnalyticsOrdersList
                    orders={orders}
                    isLoading={ordersLoading}
                    errorMessage={ordersErrorMessage}
                    onLoadMore={
                      ordersHasMore
                        ? () => setCursor(ordersResponse?.nextCursor ?? undefined)
                        : undefined
                    }
                    hasMore={ordersHasMore}
                    isLoadingMore={ordersLoading}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Completed catalog quantities</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Items ordered in completed orders only, grouped by item, segment and service.
                  </p>
                </CardHeader>
                <CardContent>
                  <CompletedCatalogItemsTable
                    rows={completedCatalogItems}
                    isLoading={completedCatalogLoading}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
