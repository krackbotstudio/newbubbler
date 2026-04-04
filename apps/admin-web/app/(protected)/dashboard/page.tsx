'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { getStoredUser, isBranchFilterLocked, isBranchScopedStaff } from '@/lib/auth';
import { useAnalyticsRevenue, useDashboardKpis } from '@/hooks/useAnalytics';
import { useOrders } from '@/hooks/useOrders';
import { useOrderSummary } from '@/hooks/useOrderSummary';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { formatMoney, isoToLocalDateKey } from '@/lib/format';
import type { AdminOrderListRow, OrderRecord, OrderStatus, ServiceType } from '@/types';

const DASHBOARD_STATUS_CHIPS: { status: OrderStatus | 'CONFIRMED'; label: string }[] = [
  { status: 'CONFIRMED', label: 'Confirmed Orders' },
  { status: 'PICKED_UP', label: 'Picked up' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const STATUSES_FOR_CHIPS: OrderStatus[] = ['BOOKING_CONFIRMED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  WASH_FOLD: 'Wash & Fold',
  WASH_IRON: 'Wash & Iron',
  STEAM_IRON: 'Steam Ironing',
  DRY_CLEAN: 'Dry Cleaning',
  HOME_LINEN: 'Home Linen',
  SHOES: 'Shoes',
  ADD_ONS: 'Add ons',
};

function safeExternalHref(url: string | null | undefined): string | null {
  const t = (url ?? '').trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch {
    return null;
  }
  return null;
}

function pickupDateDisplay(pickupDate: string): string {
  const key = typeof pickupDate === 'string' && pickupDate.length >= 10 ? pickupDate.slice(0, 10) : pickupDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return pickupDate;
  const d = new Date(key + 'T12:00:00Z');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function serviceLinesFromOrder(order: Pick<OrderRecord, 'serviceType' | 'serviceTypes'>): string[] {
  const types =
    order.serviceTypes?.length > 0 ? order.serviceTypes : [order.serviceType];
  const uniq = [...new Set(types)];
  return uniq.map((t) => SERVICE_TYPE_LABELS[t] ?? t.replace(/_/g, ' '));
}

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

const DASHBOARD_REFRESH_MS = 5000;

/** Short two-tone chime when a new order id appears after refresh. May be blocked until user interacts (browser autoplay). */
function playNewOrderChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AC =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beep = (startAt: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.1, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.16);
      osc.start(startAt);
      osc.stop(startAt + 0.18);
    };
    const t = ctx.currentTime;
    beep(t, 784);
    beep(t + 0.12, 988);
    void ctx.resume?.();
  } catch {
    /* autoplay or Web Audio unavailable */
  }
}

export default function DashboardPage() {
  const user = useMemo(() => getStoredUser(), []);
  const role = user?.role ?? 'CUSTOMER';
  const branchScoped = isBranchScopedStaff(role);
  const branchLocked = isBranchFilterLocked(role, user?.branchId);
  const [branchId, setBranchId] = useState<string>(() =>
    branchLocked && user?.branchId ? user.branchId : ''
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'CONFIRMED' | ''>('CONFIRMED');
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (branchLocked && user?.branchId) setBranchId(user.branchId);
  }, [branchLocked, user?.branchId]);

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

  const { data, isLoading, error } = useAnalyticsRevenue({
    preset: 'TODAY',
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useDashboardKpis({
    refetchInterval: DASHBOARD_REFRESH_MS,
    enabled: !branchScoped,
  });
  const { data: branches = [] } = useBranches();
  const effectiveBranchId = branchLocked
    ? (user?.branchId ?? undefined)
    : (branchId || undefined);

  const { data: ordersData, isLoading: ordersLoading } = useOrders(
    {
      pickupDateFrom,
      pickupDateTo,
      limit: 200,
      branchId: effectiveBranchId ?? undefined,
    },
    { refetchInterval: DASHBOARD_REFRESH_MS }
  );

  const ordersTrackingKey = `${effectiveBranchId ?? ''}|${pickupDateFrom}|${pickupDateTo}`;
  const prevOrderIdsRef = useRef<Set<string> | null>(null);
  const ordersSnapshotInitializedRef = useRef(false);

  useEffect(() => {
    ordersSnapshotInitializedRef.current = false;
    prevOrderIdsRef.current = null;
  }, [ordersTrackingKey]);

  useEffect(() => {
    const rows = ordersData?.data;
    if (!rows) return;
    const ids = new Set(rows.map((r) => r.id));
    if (!ordersSnapshotInitializedRef.current) {
      ordersSnapshotInitializedRef.current = true;
      prevOrderIdsRef.current = ids;
      return;
    }
    const prev = prevOrderIdsRef.current;
    if (!prev) {
      prevOrderIdsRef.current = ids;
      return;
    }
    let hasNew = false;
    for (const id of ids) {
      if (!prev.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew && prev.size > 0) playNewOrderChime();
    prevOrderIdsRef.current = ids;
  }, [ordersData?.data]);

  const { data: previewSummary, isLoading: previewLoading, error: previewError } =
    useOrderSummary(previewOrderId);

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
      {error && !branchScoped && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Failed to load analytics.</p>
          <ErrorDisplay error={error} className="mt-2" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {branchLocked ? (
          <LockedBranchSelect branchId={user?.branchId} selectClassName="min-w-[140px]" />
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

      {/* KPIs: Branch Head / Agent — branch today metrics only (no org-wide KPIs). */}
      <div
        className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${branchScoped ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}`}
      >
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
        {!branchScoped ? (
          <>
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
          </>
        ) : null}
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
              Grouped by pickup date (chosen by customer). Missed past dates at top. Refreshes every 5s.
            </p>
          )}
          {statusFilter && statusFilter !== 'CONFIRMED' && (
            <p className="text-sm text-muted-foreground mb-4">
              Grouped by date when order reached this status. Refreshes every 5s.
            </p>
          )}
          {!statusFilter && (
            <p className="text-sm text-muted-foreground mb-4">
              Confirmed: by pickup date. Others: by date of that status. Refreshes every 5s.
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
                    <div className="text-sm font-semibold mb-2 flex items-start justify-between gap-2">
                      <span>
                        {dayLabel}
                        {isMissed && statusFilter === 'CONFIRMED' && (
                          <span className="text-destructive text-xs block">Missed</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                        {rows.length} {rows.length === 1 ? 'order' : 'orders'}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {rows.map((row) => {
                        const isSub = isSubscriptionOrder(row);
                        const rowBg = isSub
                          ? 'bg-sky-50 dark:bg-sky-950/30'
                          : 'bg-fuchsia-50 dark:bg-fuchsia-950/30';
                        const status = row.status as OrderStatus;
                        const slot =
                          statusFilter === 'CONFIRMED' ? row.timeWindow : row.timeWindow || '—';
                        const displayName = row.customerName?.trim() || row.id.slice(0, 8);
                        return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => setPreviewOrderId(row.id)}
                            className={`w-full text-left text-xs cursor-pointer rounded-md px-2 py-1.5 ${rowBg} hover:ring-1 hover:ring-primary/30`}
                            title={`${displayName} · ${slot}${isSub ? ' · Subscription' : ''} · ${status}`}
                          >
                            <span className="block font-medium text-foreground truncate">{displayName}</span>
                            <span className="mt-1 inline-block rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                              {slot}
                            </span>
                          </button>
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

      <Dialog
        open={previewOrderId != null}
        onOpenChange={(open) => {
          if (!open) setPreviewOrderId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
          </DialogHeader>
          {previewLoading && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {!previewLoading && previewError && (
            <ErrorDisplay error={previewError} className="text-sm" />
          )}
          {!previewLoading && previewSummary && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Customer</p>
                <p className="font-semibold text-base">
                  {previewSummary.customer.name?.trim() || '—'}
                </p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">Mobile</p>
                <p className="text-sm font-medium tabular-nums">
                  {previewSummary.customer.phone?.trim() || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Address</p>
                <p className="mt-0.5 whitespace-pre-wrap">
                  {previewSummary.address.label ? (
                    <span className="font-medium">{previewSummary.address.label}: </span>
                  ) : null}
                  {previewSummary.address.addressLine}
                  {previewSummary.address.pincode ? `, ${previewSummary.address.pincode}` : ''}
                </p>
                {(() => {
                  const mapHref = safeExternalHref(previewSummary.address.googleMapUrl);
                  return mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-primary font-medium hover:underline"
                    >
                      Open in Maps
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </a>
                  ) : null;
                })()}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pickup</p>
                <p className="mt-0.5">
                  <span className="inline-block rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                    {previewSummary.order.timeWindow || '—'}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {pickupDateDisplay(previewSummary.order.pickupDate)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Services</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {(previewSummary.orderItems?.length ?? 0) > 0
                    ? previewSummary.orderItems!.map((item) => (
                        <li key={item.id}>
                          {(item.name ?? item.serviceType).replace(/_/g, ' ')}
                          {item.quantity != null && item.quantity !== 0 ? (
                            <span className="text-muted-foreground"> × {item.quantity}</span>
                          ) : null}
                        </li>
                      ))
                    : serviceLinesFromOrder(previewSummary.order).map((line, i) => (
                        <li key={`${line}-${i}`}>{line}</li>
                      ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewOrderId(null)}>
              Close
            </Button>
            {previewOrderId && (
              <Button type="button" asChild>
                <Link href={`/orders/${previewOrderId}`} onClick={() => setPreviewOrderId(null)}>
                  Go to order page
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
