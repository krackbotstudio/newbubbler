'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type OrderListItem, useCustomerFlowOrders } from '@/hooks/customer-flow/use-orders';
import { buttonVariants } from '@/components/customer-flow/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { Skeleton } from '@/components/customer-flow/ui/skeleton';
import { fetchPortalPublic } from '@/lib/customer-flow/portal';

function orderStatusLabel(status: string): string {
  const s = (status || '').toUpperCase().replace(/-/g, '_');
  const map: Record<string, string> = {
    BOOKING_CONFIRMED: 'Booking confirmed',
    PICKUP_SCHEDULED: 'Scheduled Pick up',
    PICKED_UP: 'Picked up',
    IN_PROCESSING: 'In progress',
    READY: 'Ready',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };
  return map[s] ?? status;
}

function serviceTypeDisplayLabel(serviceType: string): string {
  const s = (serviceType || '').toUpperCase().replace(/-/g, '_').trim();
  const map: Record<string, string> = {
    WASH_FOLD: 'Wash and Fold',
    WASH_IRON: 'Wash and Iron',
    DRY_CLEAN: 'Dry cleaning',
    STEAM_IRON: 'Steam Iron',
    SHOES: 'Shoes',
    HOME_LINEN: 'Home linen',
    ADD_ONS: 'Add-ons',
  };
  return (map[s] ?? String(serviceType)).replace(/_/g, ' ');
}

export default function CustomerFlowOrdersPage() {
  const { data: orders, isLoading, error } = useCustomerFlowOrders();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  // Deterministic SSR/CSR first paint to avoid hydration mismatch.
  const [primary, setPrimary] = useState('#8a1459');
  const [secondary, setSecondary] = useState('#f4e8f0');

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p?.primaryColor) setPrimary(p.primaryColor);
      if (p?.secondaryColor) setSecondary(p.secondaryColor);
    });
  }, [branchSlug]);

  const cardBg = useMemo(() => secondary, [primary, secondary]);
  const cardBorder = useMemo(() => `color-mix(in srgb, ${secondary} 78%, #d1d5db)`, [primary, secondary]);
  const textPrimary = useMemo(() => `color-mix(in srgb, ${primary} 80%, #111827)`, [primary]);
  const textMuted = useMemo(() => `color-mix(in srgb, ${primary} 45%, #4b5563)`, [primary]);
  const statusPillBg = useMemo(() => `color-mix(in srgb, ${primary} 16%, white)`, [primary]);
  const sortedOrders = useMemo(() => {
    const list = orders ?? [];
    const ongoing = list.filter((o) => {
      const s = (o.status || '').toUpperCase();
      return s !== 'DELIVERED' && s !== 'CANCELLED';
    });
    const completed = list.filter((o) => {
      const s = (o.status || '').toUpperCase();
      return s === 'DELIVERED' || s === 'CANCELLED';
    });
    return [...ongoing, ...completed];
  }, [orders]);

  function orderTypeLabel(o: OrderListItem): string {
    if (o.orderSource === 'WALK_IN') return 'Walk-in';
    if ((o.orderType ?? '').toUpperCase() === 'SUBSCRIPTION') return 'Subscription';
    return 'Online';
  }

  function utilisationSummary(o: OrderListItem): string {
    return (o.serviceType || '')
      .split(',')
      .map((s) => serviceTypeDisplayLabel(s.trim()))
      .filter(Boolean)
      .join(', ') || '—';
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
      <div className="mx-auto max-w-md">
        <header className="mb-4">
          <h1 className="text-2xl font-bold" style={{ color: textPrimary }}>Orders</h1>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>
            All orders (ongoing and completed) with status and utilisation.
          </p>
        </header>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" style={{ backgroundColor: cardBg }} />
            <Skeleton className="h-24 w-full" style={{ backgroundColor: cardBg }} />
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">Failed to load orders. Check API and try again.</p>
        )}
        {orders && orders.length === 0 && (
          <Card style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
            <CardHeader>
              <CardTitle style={{ color: textPrimary }}>No orders yet</CardTitle>
              <CardDescription style={{ color: textMuted }}>Create your first order to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`${base}/create-order`} className={cn(buttonVariants())}>
                Create order
              </Link>
            </CardContent>
          </Card>
        )}
        {sortedOrders.length > 0 && (
          <ul className="space-y-3">
            {sortedOrders.map((o) => {
              const status = String(o.status || '').toUpperCase();
              const isActive = status !== 'DELIVERED' && status !== 'CANCELLED';
              const isCancelled = status === 'CANCELLED';
              const paymentStatus = String(o.paymentStatus || '').toUpperCase();
              const isPaid = paymentStatus === 'CAPTURED' || paymentStatus === 'PAID';
              return (
                <li key={o.id}>
                  <Link
                    href={`${base}/orders/${o.id}`}
                    className="block rounded-xl border p-4"
                    style={{
                      backgroundColor: isActive
                        ? primary
                        : isCancelled
                          ? '#fee2e2'
                          : cardBg,
                      borderColor: isActive
                        ? primary
                        : isCancelled
                          ? '#fecaca'
                          : cardBorder,
                    }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: isActive ? '#ffffff' : isCancelled ? '#7f1d1d' : textPrimary }}
                      >
                        #{o.id}
                      </p>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: isActive
                            ? '#ffffff'
                            : isCancelled
                              ? '#b91c1c'
                            : primary,
                          color: isActive ? primary : '#ffffff',
                        }}
                      >
                        {orderTypeLabel(o)}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: isActive ? '#ffffff' : isCancelled ? '#7f1d1d' : textPrimary }}>
                      {String(o.pickupDate).slice(0, 10)} {o.timeWindow}
                    </p>
                    <p
                      className="mt-1 text-[13px]"
                      style={{ color: isActive ? 'rgba(255,255,255,0.92)' : isCancelled ? '#991b1b' : textMuted }}
                    >
                      Utilisation: {utilisationSummary(o)}
                    </p>
                    {isPaid ? (
                      <p
                        className="mt-2 text-sm font-semibold"
                        style={{
                          color: isActive
                            ? '#ffffff'
                            : isCancelled
                              ? '#7f1d1d'
                              : `color-mix(in srgb, ${primary} 60%, #166534)`,
                        }}
                      >
                        Paid{o.amountToPayPaise && o.amountToPayPaise > 0 ? `: ₹${(o.amountToPayPaise / 100).toFixed(2)}` : ''}
                      </p>
                    ) : paymentStatus === 'FAILED' ? (
                      <p className="mt-2 text-sm font-semibold" style={{ color: isActive ? '#fee2e2' : '#dc2626' }}>Payment failed</p>
                    ) : o.amountToPayPaise && o.amountToPayPaise > 0 ? (
                      <p
                        className="mt-2 text-sm font-semibold"
                        style={{ color: isActive ? '#ffffff' : isCancelled ? '#7f1d1d' : textPrimary }}
                      >
                        Amount to pay: ₹{(o.amountToPayPaise / 100).toFixed(2)}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor: isActive
                            ? 'rgba(255,255,255,0.16)'
                            : isCancelled
                              ? '#fecaca'
                            : statusPillBg,
                          color: isActive ? '#ffffff' : isCancelled ? '#7f1d1d' : textPrimary,
                        }}
                      >
                        {orderStatusLabel(o.status)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}


