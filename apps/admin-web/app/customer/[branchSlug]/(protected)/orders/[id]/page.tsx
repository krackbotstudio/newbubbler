'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCustomerFlowOrder, useCustomerFlowOrderInvoices } from '@/hooks/customer-flow/use-orders';
import { useCustomerFlowFeedbackEligibility } from '@/hooks/customer-flow/use-feedback-eligibility';
import { useSubmitCustomerFlowOrderFeedback } from '@/hooks/customer-flow/use-submit-order-feedback';
import { buttonVariants } from '@/components/customer-flow/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { Skeleton } from '@/components/customer-flow/ui/skeleton';
import { fetchPortalPublic } from '@/lib/customer-flow/portal';
import { getApiOrigin } from '@/lib/api';
import { getCustomerFlowApiError } from '@/lib/customer-flow/api';

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

export default function CustomerFlowOrderDetailPage() {
  const params = useParams<{ branchSlug: string; id: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const { data: order, isLoading, error } = useCustomerFlowOrder(id);
  const { data: orderInvoices = [], isLoading: invoicesLoading } = useCustomerFlowOrderInvoices(id);
  const feedbackEligibility = useCustomerFlowFeedbackEligibility(id);
  const submitFeedback = useSubmitCustomerFlowOrderFeedback();
  // Keep SSR/CSR first paint deterministic to avoid hydration mismatch.
  const [primary, setPrimary] = useState('#8a1459');
  const [secondary, setSecondary] = useState('#f4e8f0');
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackPromptAttempted, setFeedbackPromptAttempted] = useState(false);

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
  const statusChipBg = useMemo(() => `color-mix(in srgb, ${primary} 18%, ${secondary})`, [primary, secondary]);
  const invoicesToShow = useMemo(() => {
    const hasFinal = orderInvoices.some((i) => i.type === 'FINAL');
    return hasFinal ? orderInvoices.filter((i) => i.type === 'FINAL') : orderInvoices;
  }, [orderInvoices]);
  const feedbackStorageKey = useMemo(
    () => (id ? `customer-flow-feedback-submitted:${id}` : null),
    [id],
  );

  useEffect(() => {
    if (!id || !feedbackStorageKey || typeof window === 'undefined') return;
    const submitted = window.localStorage.getItem(feedbackStorageKey) === '1';
    if (submitted) setFeedbackPromptAttempted(true);
  }, [id, feedbackStorageKey]);

  useEffect(() => {
    if (!id || !order) return;
    const status = String(order.status || '').toUpperCase();
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();
    const isPaid = paymentStatus === 'CAPTURED' || paymentStatus === 'PAID';
    if (status !== 'DELIVERED' || !isPaid) return;
    if (feedbackPromptAttempted || feedbackModalVisible) return;
    if (feedbackEligibility.isLoading) return;
    if (feedbackEligibility.isError) {
      // PWA behavior: if eligibility check fails, still prompt.
      setFeedbackRating(null);
      setFeedbackComment('');
      setFeedbackError(null);
      setFeedbackModalVisible(true);
      setFeedbackPromptAttempted(true);
      return;
    }
    if (feedbackEligibility.data?.eligible && !feedbackEligibility.data?.alreadySubmitted) {
      setFeedbackRating(null);
      setFeedbackComment('');
      setFeedbackError(null);
      setFeedbackModalVisible(true);
      setFeedbackPromptAttempted(true);
    }
  }, [
    id,
    order,
    feedbackPromptAttempted,
    feedbackModalVisible,
    feedbackEligibility.isLoading,
    feedbackEligibility.isError,
    feedbackEligibility.data,
  ]);

  if (isLoading || !id) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
        <Skeleton className="h-64 w-full max-w-lg" style={{ backgroundColor: cardBg }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
        <Card className="max-w-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <CardContent className="pt-6">
            <p className="text-destructive">Order not found or access denied.</p>
            <Link href={`${base}/orders`} className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
              Back to orders
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canFeedback =
    order.status === 'DELIVERED' &&
    (order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID');
  const feedbackAlreadySubmitted = feedbackEligibility.data?.alreadySubmitted === true;
  const feedbackEligible = feedbackEligibility.data?.eligible !== false;
  const orderDate = (() => {
    const d = new Date(`${String(order.pickupDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(order.pickupDate).slice(0, 10);
    return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase()} ${d.getFullYear()}`;
  })();
  const rawSlot = (order.timeWindow || '').trim();
  const slotStart = rawSlot.split('-')[0]?.trim() || rawSlot;
  const slotMatch = slotStart.match(/^(\d{1,2}):(\d{2})$/);
  const orderTime = slotMatch
    ? `${String((Number(slotMatch[1]) % 12) || 12).padStart(2, '0')}:${slotMatch[2]} ${Number(slotMatch[1]) >= 12 ? 'PM' : 'AM'}`
    : slotStart.toUpperCase();
  const isPaid = order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID';
  const amountToPayPaise = (order as { amountToPayPaise?: number | null }).amountToPayPaise ?? null;

  function iconUrl(icon?: string | null): string | null {
    if (!icon) return null;
    if (icon.startsWith('http://') || icon.startsWith('https://')) return icon;
    if (icon.startsWith('/')) return `${getApiOrigin()}${icon}`;
    return null;
  }

  async function handleSubmitOrderFeedback() {
    if (!id) return;
    if (feedbackRating == null) {
      setFeedbackError('Please select a star rating.');
      return;
    }
    setFeedbackError(null);
    try {
      await submitFeedback.mutateAsync({
        orderId: id,
        rating: feedbackRating,
        message: feedbackComment || undefined,
      });
      if (feedbackStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(feedbackStorageKey, '1');
      }
      setFeedbackModalVisible(false);
    } catch (err) {
      setFeedbackError(getCustomerFlowApiError(err).message);
    }
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
      <header className="mb-6">
        <Link href={`${base}/orders`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Orders
        </Link>
      </header>
      <Card className="mx-auto max-w-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: textPrimary }}>Order #{order.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#ffffff', border: `1px solid ${cardBorder}` }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: textMuted }}>Status</p>
              <span
                className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: statusChipBg, color: textPrimary }}
              >
                {orderStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: textMuted }}>Address</p>
            <p className="text-base font-semibold" style={{ color: textPrimary }}>{order.pincode ? `Pincode ${order.pincode}` : 'Address'}</p>
            <div className="mt-3 flex justify-between text-sm">
              <span style={{ color: textMuted }}>Date</span>
              <span className="font-semibold" style={{ color: textPrimary }}>{orderDate}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span style={{ color: textMuted }}>Time</span>
              <span className="font-semibold" style={{ color: textPrimary }}>{orderTime || '—'}</span>
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide" style={{ color: textMuted }}>Services</p>
            <p className="text-base font-semibold" style={{ color: textPrimary }}>{serviceTypeDisplayLabel(order.serviceType) || '—'}</p>
          </div>

          {isPaid ? (
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: primary }}>
              <p className="text-sm font-semibold text-white/90">Payment status</p>
              <p className="text-xl font-bold text-white">Paid</p>
            </div>
          ) : amountToPayPaise && amountToPayPaise > 0 ? (
            <div className="rounded-xl border px-4 py-3" style={{ backgroundColor: '#ffffff', borderColor: cardBorder }}>
              <p className="text-sm font-semibold" style={{ color: textMuted }}>Amount to pay</p>
              <p className="text-xl font-bold" style={{ color: textPrimary }}>₹{(amountToPayPaise / 100).toFixed(2)}</p>
            </div>
          ) : null}

          <p className="text-sm" style={{ color: textMuted }}>Created: {new Date(order.createdAt).toLocaleString('en-IN')}</p>

          <div className="pt-2">
            <p className="mb-2 text-sm font-semibold" style={{ color: textPrimary }}>Invoices</p>
            {invoicesLoading ? (
              <p className="text-sm" style={{ color: textMuted }}>Loading…</p>
            ) : invoicesToShow.length === 0 ? (
              <p className="text-sm" style={{ color: textMuted }}>No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {invoicesToShow.map((inv) => {
                  const items = inv.items ?? [];
                  const discountPaise = inv.discountPaise ?? 0;
                  const subtotal = inv.subtotal ?? inv.total;
                  const tax = inv.tax ?? 0;
                  const issuedLabel = inv.issuedAt
                    ? new Date(inv.issuedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;
                  return (
                    <div key={inv.id} className="rounded-xl border p-3" style={{ backgroundColor: '#ffffff', borderColor: cardBorder }}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                            {inv.type === 'ACKNOWLEDGEMENT' ? 'Acknowledgement invoice' : inv.type === 'FINAL' ? 'Final invoice' : inv.type}
                          </p>
                          {inv.code ? (
                            <p className="text-xs" style={{ color: textMuted }}>
                              Invoice no: {inv.code}
                            </p>
                          ) : null}
                        </div>
                        {issuedLabel ? (
                          <p className="text-xs text-right" style={{ color: textMuted }}>
                            Issued: {issuedLabel}
                          </p>
                        ) : null}
                      </div>
                      {items.length > 0 ? (
                        <>
                          <div className="space-y-2">
                            {items.map((item) => {
                              const metaParts = [item.segmentLabel?.trim() || null, item.serviceLabel?.trim() || null].filter(Boolean) as string[];
                              const meta = metaParts.length ? metaParts.join(' · ') : null;
                              const src = iconUrl(item.icon);
                              return (
                                <div key={item.id} className="flex items-start gap-2">
                                  {src ? (
                                    <img src={src} alt="" className="mt-0.5 h-6 w-6 rounded object-contain" />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium" style={{ color: textPrimary }}>
                                      {item.name}
                                      {item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                                    </p>
                                    {meta ? (
                                      <p className="text-xs" style={{ color: textMuted }}>{meta}</p>
                                    ) : null}
                                  </div>
                                  <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                                    ₹{(item.amount / 100).toFixed(2)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 border-t pt-2" style={{ borderColor: cardBorder }}>
                            <div className="flex items-center justify-between text-sm">
                              <span style={{ color: textMuted }}>Subtotal</span>
                              <span style={{ color: textPrimary }}>₹{(subtotal / 100).toFixed(2)}</span>
                            </div>
                            {tax > 0 && (
                              <div className="mt-1 flex items-center justify-between text-sm">
                                <span style={{ color: textMuted }}>Tax</span>
                                <span style={{ color: textPrimary }}>₹{(tax / 100).toFixed(2)}</span>
                              </div>
                            )}
                            {discountPaise > 0 && (
                              <div className="mt-1 flex items-center justify-between text-sm">
                                <span style={{ color: textMuted }}>Discount</span>
                                <span style={{ color: `color-mix(in srgb, ${primary} 60%, #166534)` }}>- ₹{(discountPaise / 100).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-sm font-semibold" style={{ color: textPrimary }}>Total</span>
                              <span className="text-sm font-bold" style={{ color: textPrimary }}>₹{(inv.total / 100).toFixed(2)}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm" style={{ color: textMuted }}>Total: ₹{(inv.total / 100).toFixed(2)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {canFeedback ? (
            <div className="pt-2">
              {feedbackAlreadySubmitted ? (
                <p className="text-sm font-medium" style={{ color: textMuted }}>
                  Feedback submitted. Thank you!
                </p>
              ) : (
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  onClick={() => {
                    if (!feedbackEligible) {
                      setFeedbackError(feedbackEligibility.data?.reason ?? 'Feedback is not available for this order.');
                      return;
                    }
                    setFeedbackError(null);
                    setFeedbackModalVisible(true);
                  }}
                >
                  Submit feedback
                </button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {feedbackModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-white p-4 shadow-xl" style={{ borderColor: cardBorder }}>
            <p className="text-xl font-bold" style={{ color: textPrimary }}>Rate your order</p>
            <p className="mt-1 text-sm" style={{ color: textMuted }}>How was your experience? (1-5 stars)</p>
            <div className="mt-3 flex items-center justify-between">
              {[1, 2, 3, 4, 5].map((r) => {
                const active = feedbackRating != null && feedbackRating >= r;
                return (
                  <button
                    key={r}
                    type="button"
                    className="px-1 text-3xl leading-none"
                    onClick={() => !submitFeedback.isPending && setFeedbackRating(r)}
                    disabled={submitFeedback.isPending}
                    style={{ color: active ? primary : '#9ca3af' }}
                    aria-label={`Rate ${r} star${r > 1 ? 's' : ''}`}
                  >
                    {active ? '★' : '☆'}
                  </button>
                );
              })}
            </div>
            {feedbackError ? <p className="mt-2 text-sm text-red-600">{feedbackError}</p> : null}
            <textarea
              className="mt-3 min-h-[88px] w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-[var(--customer-primary,#C2185B)] focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#C2185B)]"
              style={{ borderColor: cardBorder }}
              placeholder="Optional comment"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              disabled={submitFeedback.isPending}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
                onClick={() => setFeedbackModalVisible(false)}
                disabled={submitFeedback.isPending}
              >
                Not now
              </button>
              <button
                type="button"
                className={cn(buttonVariants(), 'flex-1')}
                style={{ backgroundColor: primary }}
                onClick={() => void handleSubmitOrderFeedback()}
                disabled={submitFeedback.isPending}
              >
                {submitFeedback.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


