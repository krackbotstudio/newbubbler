'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getApiOrigin } from '@/lib/api';
import { fetchPortalPublic, getStoredPortal, type PortalPublic } from '@/lib/customer-flow/portal';
import { useCustomerFlowMe } from '@/hooks/customer-flow/use-me';
import { type OrderListItem, useCustomerFlowOrders } from '@/hooks/customer-flow/use-orders';

function assetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getApiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
}

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

export default function CustomerFlowHomePage() {
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const [portal, setPortal] = useState<PortalPublic | null>(() => getStoredPortal());
  const [carouselIndex, setCarouselIndex] = useState(0);
  const { data: me } = useCustomerFlowMe();
  const { data: orders = [] } = useCustomerFlowOrders();

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p) setPortal(p);
    });
  }, [branchSlug]);

  const carouselImages = useMemo(
    () => (portal?.carouselImages ?? []).sort((a, b) => a.position - b.position),
    [portal],
  );

  useEffect(() => {
    if (carouselImages.length <= 1) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % carouselImages.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [carouselImages.length]);

  const currentImage = carouselImages[carouselIndex] ?? carouselImages[0] ?? null;
  const imageUrl = assetUrl(currentImage?.imageUrl);
  const primary = portal?.primaryColor ?? '#8a1459';
  const secondary = portal?.secondaryColor ?? '#f4e8f0';
  const primaryText = `color-mix(in srgb, ${primary} 82%, #000)`;
  const mutedText = `color-mix(in srgb, ${primary} 45%, #374151)`;
  const softSurface = secondary;
  const softBorder = `color-mix(in srgb, ${secondary} 78%, #d1d5db)`;
  const statusPill = `color-mix(in srgb, ${primary} 12%, white)`;
  const successText = `color-mix(in srgb, ${primary} 60%, #166534)`;
  const errorText = `color-mix(in srgb, ${primary} 45%, #b91c1c)`;
  const displayName = me?.user?.name?.trim() || 'Customer';
  const activeOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || '').toUpperCase();
        return s !== 'DELIVERED' && s !== 'CANCELLED';
      }),
    [orders],
  );

  function orderTypeLabel(order: OrderListItem): string {
    if (order.orderSource === 'WALK_IN') return 'Walk-in';
    if ((order.orderType ?? '').toUpperCase() === 'SUBSCRIPTION') return 'Subscription';
    return 'Online';
  }

  function serviceLine(order: OrderListItem): string {
    return (order.serviceType || '')
      .split(',')
      .map((s) => serviceTypeDisplayLabel(s.trim()))
      .filter(Boolean)
      .join(', ');
  }

  return (
    <div className="min-h-screen p-4 pb-24" style={{ backgroundColor: "#ffffff" }}>
      <div className="mx-auto max-w-md space-y-4">
        <header
          className="flex items-center justify-between rounded-xl px-4 py-3 shadow-sm"
          style={{ backgroundColor: softSurface, border: `1px solid ${softBorder}` }}
        >
          <div className="flex items-center gap-3">
            <p className="text-lg font-bold" style={{ color: primaryText }}>
              {portal?.brandName || 'Customer'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
              style={{ borderColor: `${primary}55`, color: primary }}
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl shadow-sm" style={{ backgroundColor: softSurface, border: `1px solid ${softBorder}` }}>
          {imageUrl ? (
            <img src={imageUrl} alt="Branch banner" className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm" style={{ color: mutedText }}>
              Upload carousel image in branch portal settings
            </div>
          )}
        </div>

        <section className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: secondary }}>
          <h2 className="text-3xl font-bold" style={{ color: primaryText }}>
            Welcome, {displayName}
          </h2>
          <p className="mt-2 text-sm" style={{ color: mutedText }}>
            Use the menu below to book a pickup, view orders, and manage your profile.
          </p>
        </section>

        {activeOrders.length === 0 ? (
          <p className="pt-1 text-center text-sm" style={{ color: mutedText }}>No active orders</p>
        ) : (
          <section className="space-y-3 pt-1">
            <p className="text-center text-sm font-semibold" style={{ color: primaryText }}>Active Orders</p>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
              {activeOrders.map((o) => {
                const isPaid = o.paymentStatus === 'CAPTURED' || o.paymentStatus === 'PAID';
                const toPay = o.amountToPayPaise ?? 0;
                return (
                  <Link
                    key={o.id}
                    href={`/customer/${branchSlug}/orders/${o.id}`}
                    className="block min-h-[164px] min-w-[228px] snap-start rounded-xl border p-3"
                    style={{ backgroundColor: primary, borderColor: primary }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <p className="truncate text-[11px] font-semibold text-white">#{o.id}</p>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: '#ffffff', color: primary }}
                      >
                        {orderTypeLabel(o)}
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-white">{serviceLine(o)}</p>
                    <p className="mt-1 text-xs text-white/90">{String(o.pickupDate).slice(0, 10)}</p>
                    <div className="mt-3">
                      {isPaid ? (
                        <p className="text-xs font-semibold text-white">
                          Paid{o.amountToPayPaise && o.amountToPayPaise > 0 ? ` ₹${(o.amountToPayPaise / 100).toFixed(2)}` : ''}
                        </p>
                      ) : o.paymentStatus === 'FAILED' ? (
                        <p className="text-xs font-semibold text-red-100">Payment failed</p>
                      ) : toPay > 0 ? (
                        <p className="text-xs font-semibold text-white">To pay: ₹{(toPay / 100).toFixed(2)}</p>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor:
                            (o.status || '').toUpperCase() === 'CANCELLED'
                              ? `color-mix(in srgb, ${primary} 18%, #fecaca)`
                              : 'rgba(255,255,255,0.16)',
                          color: '#ffffff',
                        }}
                      >
                        {orderStatusLabel(o.status)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}


