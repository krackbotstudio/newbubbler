'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredUser } from '@/lib/auth';
import { useAnalyticsRevenue, useDashboardKpis } from '@/hooks/useAnalytics';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { formatMoney, isoToLocalDateKey } from '@/lib/format';
import type { AdminOrderListRow, OrderStatus } from '@/types';

const DASHBOARD_STATUS_CHIPS: { status: OrderStatus | 'CONFIRMED'; label: string }[] = [
  { status: 'CONFIRMED', label: 'Confirmed Orders' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const STATUSES_FOR_CHIPS: OrderStatus[] = ['BOOKING_CONFIRMED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Current date in IST (YYYY-MM-DD). */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Normalize status timestamp from API to local calendar date YYYY-MM-DD (avoids UTC date off-by-one). */
function dateKeyFromIso(iso: string | null | undefined): string | null {
  return isoToLocalDateKey(iso);
}

function pickupDateKey(pickupDate: string): string {
  return typeof pickupDate === 'string' && pickupDate.length >= 10 ? pickupDate.slice(0, 10) : pickupDate;
}

/** Get the date key used for grouping: for confirmed = pickup date (customer-chosen); for others = status timestamp date. */
function getOrderDateKey(row: AdminOrderListRow, statusFilter: OrderStatus | 'CONFIRMED' | ''): string | null {
  const s = row.status as OrderStatus;
  if (s === 'BOOKING_CONFIRMED' || s === 'PICKUP_SCHEDULED') {
    return pickupDateKey(row.pickupDate);
  }
  if (s === 'PICKED_UP' && row.pickedUpAt) return dateKeyFromIso(row.pickedUpAt) ?? null;
  if (s === 'OUT_FOR_DELIVERY' && row.outForDeliveryAt) return dateKeyFromIso(row.outForDeliveryAt) ?? null;
  if (s === 'DELIVERED' && row.deliveredDate) return dateKeyFromIso(row.deliveredDate) ?? null;
  return null;
}

function getDayLabel(dateKey: string, todayKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  const today = new Date(todayKey + 'T12:00:00Z');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === 2) return 'Day after tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Subscription = has subscriptionId or orderType SUBSCRIPTION; else individual (online) booking. */
function isSubscriptionOrder(row: AdminOrderListRow): boolean {
  return !!(row.subscriptionId ?? (row.orderType === 'SUBSCRIPTION'));
}

export default function DashboardPage() {
  const user = useMemo(() => getStoredUser(), []);
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = role === 'OPS' && !!user?.branchId;
  const [branchId, setBranchId] = useState<string>(() =>
    isBranchHead && user?.branchId ? user.branchId : ''
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'CONFIRMED' | ''>('CONFIRMED');

  useEffect(() => {
    if (isBranchHead && user?.branchId) setBranchId(user.branchId);
  }, [isBranchHead, user?.branchId]);

  const todayKey = useMemo(() => getTodayIST(), []);
  const pickupDateFrom = useMemo(() => {
    const d = new Date(todayKey + 'T12:00:00Z');
    d.setDate(d.getDate() - 7);
    return toDateKey(d);
  }, [todayKey]);
  const pickupDateTo = useMemo(() => {
    const d = new Date(todayKey + 'T12:00:00Z');
    d.setDate(d.getDate() + 6);
    return toDateKey(d);
  }, [todayKey]);

  const { data, isLoading, error } = useAnalyticsRevenue({ preset: 'TODAY' });
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useDashboardKpis();
  const { data: branches = [] } = useBranches();
  const effectiveBranchId = isBranchHead
    ? (user?.branchId ?? undefined)
    : (branchId || undefined);

  const { data: ordersData, isLoading: ordersLoading } = useOrders(
    {
      pickupDateFrom,
      pickupDateTo,
      limit: 200,
      branchId: effectiveBranchId ?? undefined,
    },
    { refetchInterval: 30000 }
  );

  const statusCounts = useMemo(() => {
    const rows = ordersData?.data ?? [];
    const counts: Record<string, number> = {
      CONFIRMED: 0,
      PICKED_UP: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
    };
    for (const row of rows) {
      const s = row.status as OrderStatus;
      if (s === 'BOOKING_CONFIRMED' || s === 'PICKUP_SCHEDULED') counts.CONFIRMED += 1;
      else if (s in counts) counts[s] += 1;
    }
    return counts;
  }, [ordersData?.data]);

  const ordersByDate = useMemo(() => {
    const rows = ordersData?.data ?? [];
    let list: AdminOrderListRow[];
    if (statusFilter === 'CONFIRMED') {
      list = rows.filter((row) => (row.status as OrderStatus) === 'BOOKING_CONFIRMED' || (row.status as OrderStatus) === 'PICKUP_SCHEDULED');
    } else if (statusFilter) {
      list = rows.filter((row) => (row.status as OrderStatus) === statusFilter);
    } else {
      list = rows.filter((row) => STATUSES_FOR_CHIPS.includes(row.status as OrderStatus));
    }
    const withDateKey = list
      .map((row) => ({ row, dateKey: getOrderDateKey(row, statusFilter) }))
      .filter((x): x is { row: AdminOrderListRow; dateKey: string } => x.dateKey != null);
    const sorted = [...withDateKey].sort((a, b) => {
      const aMissed = a.dateKey < todayKey ? 1 : 0;
      const bMissed = b.dateKey < todayKey ? 1 : 0;
      if (aMissed !== bMissed) return aMissed - bMissed;
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      return (a.row.timeWindow || '').localeCompare(b.row.timeWindow || '');
    });
    const byDate = new Map<string, AdminOrderListRow[]>();
    for (const { row, dateKey } of sorted) {
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(row);
    }
    const orderedKeys = Array.from(byDate.keys()).sort();
    return { list: sorted.map((x) => x.row), byDate, orderedKeys };
  }, [ordersData?.data, todayKey, statusFilter]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Failed to load analytics.</p>
          <ErrorDisplay error={error} className="mt-2" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {isBranchHead ? (
          <select
            className="h-10 min-h-[2.5rem] min-w-[140px] disabled:opacity-70"
            value={effectiveBranchId ?? ''}
            disabled
            title="Your assigned branch (cannot change)"
          >
            <option value={user?.branchId ?? ''}>
              {branches.find((b) => b.id === user?.branchId)?.name ?? user?.branchId ?? '—'}
            </option>
          </select>
        ) : (
          <select
            className="h-10 min-h-[2.5rem] min-w-[140px]"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            title="Filter dashboard by branch name"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPIs in one row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected (today)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-bold">{formatMoney(data?.collectedPaise ?? 0)}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders (today)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{data?.ordersCount ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices (today)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{data?.invoicesCount ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {kpisError ? (
              <p className="text-sm text-destructive">Failed to load</p>
            ) : kpisLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{kpis?.activeSubscriptionsCount ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total customers</CardTitle>
          </CardHeader>
          <CardContent>
            {kpisError ? (
              <p className="text-sm text-destructive">Failed to load</p>
            ) : kpisLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{kpis?.totalCustomersCount ?? 0}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_STATUS_CHIPS.map(({ status, label }) => {
          const count = statusCounts[status] ?? 0;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === status ? '' : status))}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-4">
          {statusFilter === 'CONFIRMED' && (
            <p className="text-sm text-muted-foreground mb-4">
              Grouped by pickup date (chosen by customer). Missed past dates at top.
            </p>
          )}
          {statusFilter && statusFilter !== 'CONFIRMED' && (
            <p className="text-sm text-muted-foreground mb-4">
              Grouped by date when order reached this status.
            </p>
          )}
          {!statusFilter && (
            <p className="text-sm text-muted-foreground mb-4">
              Confirmed: by pickup date. Others: by date of that status. Refreshes every 30s.
            </p>
          )}
          {ordersLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {ordersByDate.orderedKeys.map((dateKey) => {
                const rows = ordersByDate.byDate.get(dateKey)!;
                const isMissed = dateKey < todayKey;
                const dayLabel = getDayLabel(dateKey, todayKey);
                return (
                  <div
                    key={dateKey}
                    className={`rounded-lg border p-3 min-h-[120px] ${isMissed ? 'border-destructive/50 bg-destructive/5' : ''}`}
                  >
                    <div className="text-sm font-semibold mb-2">
                      {dayLabel}
                      {isMissed && statusFilter === 'CONFIRMED' && <span className="text-destructive text-xs block">Missed</span>}
                    </div>
                    <ul className="space-y-1">
                      {rows.map((row) => {
                        const isSub = isSubscriptionOrder(row);
                        const rowBg = isSub
                          ? 'bg-sky-50 dark:bg-sky-950/30'
                          : 'bg-fuchsia-50 dark:bg-fuchsia-950/30';
                        const status = row.status as OrderStatus;
                        return (
                        <li key={row.id}>
                          <Link
                            href={`/orders/${row.id}`}
                            className={`block text-xs cursor-pointer hover:underline truncate rounded px-1.5 py-0.5 ${rowBg}`}
                            title={`${row.customerName ?? row.id} · ${row.timeWindow}${isSub ? ' · Subscription' : ''} · ${status}`}
                          >
                            {row.customerName ?? row.id.slice(0, 8)} · {statusFilter === 'CONFIRMED' ? row.timeWindow : (row.timeWindow || '—')}
                          </Link>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {ordersByDate.orderedKeys.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-full py-4 text-center">
                  {statusFilter ? `No orders in this status.` : 'No orders in these statuses.'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
