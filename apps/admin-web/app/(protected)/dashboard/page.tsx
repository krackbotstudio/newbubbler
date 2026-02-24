'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import { useAnalyticsRevenue, useDashboardKpis } from '@/hooks/useAnalytics';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { BranchFilter } from '@/components/shared/BranchFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { formatMoney } from '@/lib/format';
import type { AdminOrderListRow, OrderStatus } from '@/types';

const HIDE_FROM_PICKUPS: OrderStatus[] = ['PICKED_UP', 'DELIVERED', 'CANCELLED'];

const DASHBOARD_STATUS_CHIPS: { status: OrderStatus | 'CONFIRMED'; label: string }[] = [
  { status: 'CONFIRMED', label: 'Confirmed Orders' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'IN_PROCESSING', label: 'In progress' },
  { status: 'READY', label: 'Ready' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
];

/** Current date in IST (YYYY-MM-DD) so Today/Tomorrow labels are correct for admin. */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Normalize pickupDate from API (may be ISO string) to YYYY-MM-DD. */
function pickupDateKey(pickupDate: string): string {
  return typeof pickupDate === 'string' && pickupDate.length >= 10 ? pickupDate.slice(0, 10) : pickupDate;
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
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = role === 'OPS' && !!user?.branchId;
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() =>
    isBranchHead && user?.branchId ? [user.branchId] : []
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'CONFIRMED' | ''>('');

  useEffect(() => {
    if (isBranchHead && user?.branchId) setSelectedBranchIds([user.branchId]);
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
    : (selectedBranchIds.length === 1 ? selectedBranchIds[0] : undefined);

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
      IN_PROCESSING: 0,
      READY: 0,
      OUT_FOR_DELIVERY: 0,
    };
    for (const row of rows) {
      const s = row.status as OrderStatus;
      if (s === 'BOOKING_CONFIRMED' || s === 'PICKUP_SCHEDULED') counts.CONFIRMED += 1;
      else if (s in counts) counts[s] += 1;
    }
    return counts;
  }, [ordersData?.data]);

  const scheduledPickups = useMemo(() => {
    let list = (ordersData?.data ?? []).filter(
      (row) => !HIDE_FROM_PICKUPS.includes(row.status as OrderStatus)
    );
    if (statusFilter) {
      if (statusFilter === 'CONFIRMED') {
        list = list.filter((row) => (row.status as OrderStatus) === 'BOOKING_CONFIRMED' || (row.status as OrderStatus) === 'PICKUP_SCHEDULED');
      } else {
        list = list.filter((row) => (row.status as OrderStatus) === statusFilter);
      }
    }
    const missedFirst = [...list].sort((a, b) => {
      const aKey = pickupDateKey(a.pickupDate);
      const bKey = pickupDateKey(b.pickupDate);
      const aMissed = aKey < todayKey ? 1 : 0;
      const bMissed = bKey < todayKey ? 1 : 0;
      if (aMissed !== bMissed) return aMissed - bMissed;
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return (a.timeWindow || '').localeCompare(b.timeWindow || '');
    });
    const byDate = new Map<string, AdminOrderListRow[]>();
    for (const row of missedFirst) {
      const key = pickupDateKey(row.pickupDate);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(row);
    }
    const orderedKeys = Array.from(byDate.keys()).sort();
    return { list: missedFirst, byDate, orderedKeys };
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
        <BranchFilter
          selectedBranchIds={selectedBranchIds}
          onChange={setSelectedBranchIds}
          compactLabel
          disabled={isBranchHead}
        />
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

      {/* Scheduled Pickups – calendar view only */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Pickups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Next 1 week pickups by date chosen by customer. Missed (past pickups not picked up) appear at top. New confirmed bookings appear here as soon as the customer confirms. Refreshes every 30s. Picked up or cancelled orders are hidden.
          </p>
          {ordersLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {scheduledPickups.orderedKeys.map((dateKey) => {
                const rows = scheduledPickups.byDate.get(dateKey)!;
                const isMissed = dateKey < todayKey;
                const dayLabel = getDayLabel(dateKey, todayKey);
                return (
                  <div
                    key={dateKey}
                    className={`rounded-lg border p-3 min-h-[120px] ${isMissed ? 'border-destructive/50 bg-destructive/5' : ''}`}
                  >
                    <div className="text-sm font-semibold mb-2">
                      {dayLabel}
                      {isMissed && <span className="text-destructive text-xs block">Missed</span>}
                    </div>
                    <ul className="space-y-1">
                      {rows.map((row) => {
                        const isSub = isSubscriptionOrder(row);
                        const rowBg = isSub
                          ? 'bg-sky-50 dark:bg-sky-950/30'
                          : 'bg-fuchsia-50 dark:bg-fuchsia-950/30';
                        return (
                        <li
                          key={row.id}
                          className={`text-xs cursor-pointer hover:underline truncate rounded px-1.5 py-0.5 ${rowBg}`}
                          onClick={() => router.push(`/orders/${row.id}`)}
                          title={`${row.customerName ?? row.id} · ${row.timeWindow}${isSub ? ' · Subscription' : ' · Individual'}`}
                        >
                          {row.customerName ?? row.id.slice(0, 8)} · {row.timeWindow}
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {scheduledPickups.orderedKeys.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-full py-4 text-center">No scheduled pickups.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
