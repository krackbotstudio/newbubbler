'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCustomerFlowMe, type ActiveSubscriptionSummary } from '@/hooks/customer-flow/use-me';
import { useCustomerFlowAddresses, type AddressItem } from '@/hooks/customer-flow/use-addresses';
import { useCreateCustomerFlowOrder } from '@/hooks/customer-flow/use-orders';
import { useCustomerFlowSlotAvailability } from '@/hooks/customer-flow/use-slot-availability';
import {
  CUSTOMER_FLOW_SERVICE_TYPES,
  customerFlowServiceIconUrl,
  type CustomerFlowServiceTypeId,
} from '@/lib/customer-flow/service-types';
import { filterPastSlotsToday, localDateKey } from '@/lib/customer-flow/slots';
import { getStoredPortal } from '@/lib/customer-flow/portal';
import { cn } from '@/lib/utils';

/** Matches `apps/customer-mobile/App.tsx` theme fallbacks when CSS variables are unset. */
const C = {
  primary: 'var(--customer-primary, #C2185B)',
  secondary: 'var(--customer-secondary, #f4e8f0)',
  text: 'color-mix(in srgb, var(--customer-primary, #C2185B) 82%, #111827)',
  textSecondary: 'color-mix(in srgb, var(--customer-primary, #C2185B) 45%, #4b5563)',
  elevation1: '#ffffff',
  elevation2: 'var(--customer-secondary, #f4e8f0)',
  elevation3: 'var(--customer-secondary, #f4e8f0)',
  borderLight: 'color-mix(in srgb, var(--customer-secondary, #f4e8f0) 78%, #d1d5db)',
  primaryDark: 'color-mix(in srgb, var(--customer-primary, #C2185B) 75%, #111827)',
  primaryLight: 'var(--customer-secondary, #f4e8f0)',
  error: 'color-mix(in srgb, var(--customer-primary, #C2185B) 45%, #b91c1c)',
} as const;

type BookingStep = 'services' | 'address' | 'date' | 'time' | 'confirm';

function formatConfirmTime(raw: string): string {
  const t = raw.trim();
  if (!t) return '—';
  const start = t.split('-')[0]?.trim() || t;
  const m = start.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return start.toUpperCase();
  let hh = Number(m[1]);
  const mm = m[2];
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
}

function formatConfirmDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase();
  return `${day} ${month} ${d.getFullYear()}`;
}

export default function CustomerFlowCreateOrderPage() {
  const router = useRouter();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;

  const { data: me, isLoading: meLoading } = useCustomerFlowMe();
  const { data: addresses, isLoading: addressesLoading } = useCustomerFlowAddresses();
  const createOrder = useCreateCustomerFlowOrder();

  const [portalBranchId, setPortalBranchId] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>('services');
  const [selectedServiceIds, setSelectedServiceIds] = useState<CustomerFlowServiceTypeId[]>([]);
  const [subscriptionBookingId, setSubscriptionBookingId] = useState<string | null>(null);
  const [addressId, setAddressId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [estimatedWeightKg, setEstimatedWeightKg] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const todayKey = useMemo(() => localDateKey(), []);

  useEffect(() => {
    setPortalBranchId(getStoredPortal()?.branchId ?? null);
  }, []);

  const isSubscriptionFlow = !!subscriptionBookingId;
  const activeSubscriptions = me?.activeSubscriptions ?? [];

  const subscription = useMemo(
    () => activeSubscriptions.find((s) => s.id === subscriptionBookingId) ?? null,
    [activeSubscriptions, subscriptionBookingId],
  );

  const subscriptionMinDate = useMemo(() => {
    if (!subscription?.validityStartDate) return todayKey;
    const v = subscription.validityStartDate.slice(0, 10);
    return v > todayKey ? v : todayKey;
  }, [subscription?.validityStartDate, todayKey]);

  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === addressId) ?? null,
    [addresses, addressId],
  );
  const pincode = selectedAddress?.pincode?.trim() ?? null;

  const slotQuery = useCustomerFlowSlotAvailability(
    pincode,
    pickupDate || null,
    portalBranchId,
    step === 'time' || step === 'confirm',
  );

  useEffect(() => {
    if (!pickupDate) setPickupDate(isSubscriptionFlow ? subscriptionMinDate : todayKey);
  }, [pickupDate, todayKey, isSubscriptionFlow, subscriptionMinDate]);

  useEffect(() => {
    if (isSubscriptionFlow && subscription && pickupDate) {
      const max = subscription.validTill?.slice(0, 10);
      const min = subscriptionMinDate;
      if (pickupDate < min) setPickupDate(min);
      if (max && pickupDate > max) setPickupDate(max);
    }
  }, [isSubscriptionFlow, subscription, pickupDate, subscriptionMinDate]);

  const timeSlotsFiltered = useMemo(() => {
    const raw = slotQuery.data?.timeSlots ?? [];
    if (!pickupDate) return raw;
    return filterPastSlotsToday(raw, pickupDate, todayKey);
  }, [slotQuery.data?.timeSlots, pickupDate, todayKey]);

  function toggleService(id: CustomerFlowServiceTypeId) {
    setValidationError(null);
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetIndividualBooking() {
    setSubscriptionBookingId(null);
    setSelectedServiceIds([]);
    setAddressId('');
    setPickupDate(todayKey);
    setTimeWindow('');
  }

  function startSubscriptionBook(sub: ActiveSubscriptionSummary) {
    setValidationError(null);
    if (sub.hasActiveOrder) return;
    setSubscriptionBookingId(sub.id);
    setSelectedServiceIds([]);
    if (sub.addressId) setAddressId(sub.addressId);
    setPickupDate(todayKey);
    setTimeWindow('');
    setStep('date');
  }

  useEffect(() => {
    if (!addresses?.length) return;
    if (isSubscriptionFlow && subscription?.addressId) {
      if (!addressId || addressId !== subscription.addressId) setAddressId(subscription.addressId);
      return;
    }
    if (!isSubscriptionFlow && !addressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) setAddressId(def.id);
    }
  }, [addresses, addressId, isSubscriptionFlow, subscription?.addressId]);

  function continueFromServices() {
    setValidationError(null);
    if (selectedServiceIds.length === 0) {
      setValidationError('Please select at least one service.');
      return;
    }
    setSubscriptionBookingId(null);
    setStep('address');
  }

  function continueFromAddress() {
    setValidationError(null);
    if (!addressId || !selectedAddress) {
      setValidationError('Choose an address to continue.');
      return;
    }
    setStep('date');
  }

  function continueFromDate() {
    setValidationError(null);
    if (!pickupDate) {
      setValidationError('Pick a date for pickup.');
      return;
    }
    if (!pincode) {
      setValidationError('Address pincode is missing.');
      return;
    }
    setTimeWindow('');
    setStep('time');
  }

  function selectTimeSlot(slot: string) {
    setValidationError(null);
    setTimeWindow(slot);
    setStep('confirm');
  }

  function handleConfirmSubmit() {
    setValidationError(null);
    if (!addressId || !pickupDate || !timeWindow) {
      setValidationError('Complete date, time, and address.');
      return;
    }
    if (!isSubscriptionFlow && selectedServiceIds.length === 0) {
      setValidationError('Please select at least one service.');
      return;
    }
    const pickupIso = new Date(`${pickupDate}T12:00:00`).toISOString();
    if (isSubscriptionFlow && subscriptionBookingId) {
      createOrder.mutate(
        {
          orderType: 'SUBSCRIPTION',
          subscriptionId: subscriptionBookingId,
          addressId,
          pickupDate: pickupIso,
          timeWindow,
        },
        {
          onSuccess: (data) => {
            resetIndividualBooking();
            router.push(`${base}/orders/${data.orderId}`);
          },
        },
      );
      return;
    }
    createOrder.mutate(
      {
        orderType: 'INDIVIDUAL',
        selectedServices: selectedServiceIds,
        addressId,
        pickupDate: pickupIso,
        timeWindow,
        estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : undefined,
      },
      {
        onSuccess: (data) => {
          resetIndividualBooking();
          router.push(`${base}/orders/${data.orderId}`);
        },
      },
    );
  }

  if (meLoading || addressesLoading) {
    return (
      <div className="min-h-screen animate-pulse" style={{ backgroundColor: C.elevation1 }}>
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="h-64 rounded-[18px]" style={{ backgroundColor: C.elevation3 }} />
        </div>
      </div>
    );
  }

  if (!addresses?.length) {
    return (
      <div className="min-h-screen px-4 py-6 pb-28" style={{ backgroundColor: C.elevation1 }}>
        <div className="mx-auto max-w-md rounded-[18px] p-6 shadow-sm" style={{ backgroundColor: C.elevation3 }}>
          <h1 className="text-xl font-bold" style={{ color: C.text }}>
            No address
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.textSecondary }}>
            Add an address before booking a pickup.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${base}/addresses`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-base font-semibold text-white"
              style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
            >
              Add address
            </Link>
            <Link href={`${base}/home`} className="text-sm font-medium underline" style={{ color: C.textSecondary }}>
              Cancel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryBtn =
    'inline-flex w-full min-h-12 items-center justify-center rounded-lg px-4 text-base font-semibold text-white disabled:opacity-70';
  const cardClass = 'mx-3 rounded-[18px] p-6 shadow-sm';
  const cardStyle = { backgroundColor: C.elevation3, boxShadow: '0 4px 12px rgba(136, 14, 79, 0.08)' };

  return (
    <div className="min-h-screen pb-28 pt-2" style={{ backgroundColor: C.elevation1 }}>
      <div className="mx-auto max-w-md">
        {step === 'services' && (
          <div className={cn(cardClass)} style={cardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              Select services
            </h1>
            <p className="mb-4 text-sm" style={{ color: C.textSecondary }}>
              Select at least one service. You can choose multiple.
            </p>
            {validationError ? (
              <p className="mb-3 text-sm font-medium" style={{ color: C.error }}>
                {validationError}
              </p>
            ) : null}

            <div className="mb-4 grid grid-cols-2 gap-3">
              {CUSTOMER_FLOW_SERVICE_TYPES.map((s) => {
                const selected = selectedServiceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className="flex min-h-[88px] flex-col items-start justify-center rounded-xl border-2 p-4 text-left transition-colors"
                    style={{
                      borderColor: selected ? 'var(--customer-primary, #C2185B)' : C.borderLight,
                      backgroundColor: selected ? C.elevation3 : C.elevation2,
                    }}
                  >
                    <Image
                      src={customerFlowServiceIconUrl(s.iconFile)}
                      alt=""
                      width={42}
                      height={42}
                      className="mb-2 object-contain"
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: selected ? C.text : C.textSecondary }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedServiceIds.length > 0 ? (
              <p className="mb-3 text-[13px]" style={{ color: C.textSecondary }}>
                Selected: {selectedServiceIds.length} service(s)
              </p>
            ) : null}

            <button
              type="button"
              disabled={selectedServiceIds.length === 0}
              className={primaryBtn}
              style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
              onClick={continueFromServices}
            >
              Continue → Address
            </button>

            {activeSubscriptions.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1 text-sm font-semibold" style={{ color: C.textSecondary }}>
                  Active plans
                </p>
                <p className="mb-3 text-[13px] leading-snug" style={{ color: C.textSecondary }}>
                  Tap a plan to book a slot (address is locked for the subscription). You cannot book again with a plan
                  that already has an order in progress.
                </p>
                <div className="space-y-3">
                  {activeSubscriptions.map((sub) => {
                    const locked = !!sub.hasActiveOrder;
                    const addrLabel =
                      sub.addressLabel ??
                      (sub.addressId ? addresses.find((a) => a.id === sub.addressId)?.label : null) ??
                      'Address';
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        disabled={locked || !sub.addressId}
                        onClick={() => !locked && sub.addressId && startSubscriptionBook(sub)}
                        className="w-full rounded-xl border p-3 text-left"
                        style={{
                          borderColor: C.borderLight,
                          backgroundColor: locked ? C.borderLight : C.elevation2,
                          opacity: locked ? 0.75 : 1,
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold" style={{ color: C.text }}>
                            {sub.planName ?? 'Plan'}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: C.primaryLight, color: C.primaryDark }}
                          >
                            {addrLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: C.textSecondary }}>
                          {sub.remainingPickups}/{sub.maxPickups} pickups left
                          {sub.validTill ? ` · Valid till ${sub.validTill.slice(0, 10)}` : ''}
                        </p>
                        {locked ? (
                          <p className="mt-2 text-xs" style={{ color: C.textSecondary }}>
                            You have an active order with this plan. Complete or wait for it before booking again.
                          </p>
                        ) : null}
                        {!sub.addressId ? (
                          <p className="mt-2 text-xs" style={{ color: C.error }}>
                            This plan has no address on file. Contact support.
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 w-full text-center text-sm underline"
              style={{ color: C.textSecondary }}
              onClick={() => {
                setValidationError(null);
                router.push(`${base}/home`);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'address' && (
          <div className={cn(cardClass)} style={cardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              Select address
            </h1>
            <p className="mb-4 text-sm" style={{ color: C.textSecondary }}>
              Choose a saved address for pickup, or add one.
            </p>
            {validationError ? (
              <p className="mb-3 text-sm font-medium" style={{ color: C.error }}>
                {validationError}
              </p>
            ) : null}

            <div className="space-y-3">
              {addresses.map((a: AddressItem) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAddressId(a.id)}
                  className="w-full rounded-lg border-2 p-3 text-left"
                  style={{
                    borderColor: addressId === a.id ? 'var(--customer-primary, #C2185B)' : C.borderLight,
                    backgroundColor: addressId === a.id ? C.elevation3 : C.elevation2,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold" style={{ color: C.text }}>
                      {a.label || 'Address'}
                    </span>
                    {a.isDefault ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
                      >
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: C.textSecondary }}>
                    {a.addressLine}
                  </p>
                  <p className="text-xs" style={{ color: C.textSecondary }}>
                    Pincode: {a.pincode}
                  </p>
                </button>
              ))}
            </div>

            <Link
              href={`${base}/addresses`}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border text-sm font-medium"
              style={{ borderColor: C.borderLight, backgroundColor: C.elevation2, color: C.text }}
            >
              + Add address
            </Link>

            <button
              type="button"
              className={cn(primaryBtn, 'mt-4')}
              style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
              onClick={continueFromAddress}
            >
              Continue → Date
            </button>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm underline"
              style={{ color: C.textSecondary }}
              onClick={() => {
                setValidationError(null);
                setStep('services');
              }}
            >
              Back
            </button>
          </div>
        )}

        {step === 'date' && (
          <div className={cn(cardClass)} style={cardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              Select date
            </h1>
            <p className="mb-4 text-sm" style={{ color: C.textSecondary }}>
              {isSubscriptionFlow
                ? 'Pick a date within your subscription validity.'
                : 'Pick a date for pickup (we’ll show available time slots).'}
            </p>
            {isSubscriptionFlow && subscription ? (
              <p className="mb-3 text-[13px]" style={{ color: C.textSecondary }}>
                Valid from{' '}
                {subscription.validityStartDate
                  ? new Date(`${subscription.validityStartDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
                {' to '}
                {subscription.validTill
                  ? new Date(`${subscription.validTill.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            ) : null}
            {validationError ? (
              <p className="mb-3 text-sm font-medium" style={{ color: C.error }}>
                {validationError}
              </p>
            ) : null}

            {isSubscriptionFlow && selectedAddress ? (
              <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: C.elevation2 }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSecondary }}>
                  Pickup address
                </p>
                <p className="font-semibold" style={{ color: C.text }}>
                  {selectedAddress.label}
                </p>
                <p className="text-sm" style={{ color: C.textSecondary }}>
                  {selectedAddress.addressLine}
                </p>
              </div>
            ) : null}

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium" style={{ color: C.text }}>
                Date
              </span>
              <input
                type="date"
                min={isSubscriptionFlow ? subscriptionMinDate : todayKey}
                max={
                  isSubscriptionFlow && subscription?.validTill
                    ? subscription.validTill.slice(0, 10)
                    : undefined
                }
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="h-12 w-full rounded-lg border px-3 text-base focus-visible:outline-none focus-visible:border-[var(--customer-primary,#C2185B)] focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#C2185B)]"
                style={{ borderColor: C.borderLight, backgroundColor: C.elevation2, color: C.text }}
              />
            </label>

            <button
              type="button"
              className={primaryBtn}
              style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
              onClick={continueFromDate}
            >
              Continue → Time
            </button>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm underline"
              style={{ color: C.textSecondary }}
              onClick={() => {
                setValidationError(null);
                if (isSubscriptionFlow) {
                  resetIndividualBooking();
                  setStep('services');
                } else {
                  setStep('address');
                }
              }}
            >
              Back
            </button>
          </div>
        )}

        {step === 'time' && (
          <div className={cn(cardClass)} style={cardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              Select time
            </h1>
            <p className="mb-1 text-sm" style={{ color: C.textSecondary }}>
              Available slots for {pickupDate}
              {slotQuery.data?.branchName ? ` (${slotQuery.data.branchName})` : ''}
            </p>
            {validationError ? (
              <p className="mb-3 text-sm font-medium" style={{ color: C.error }}>
                {validationError}
              </p>
            ) : null}

            {slotQuery.isLoading ? (
              <p className="py-8 text-center text-sm" style={{ color: C.textSecondary }}>
                Loading slots…
              </p>
            ) : slotQuery.data?.isHoliday ? (
              <p className="py-4 text-sm" style={{ color: C.textSecondary }}>
                This date is a holiday — no pickups. Try another date.
              </p>
            ) : timeSlotsFiltered.length === 0 ? (
              <p className="py-4 text-sm" style={{ color: C.textSecondary }}>
                No slots available. Try another date.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {timeSlotsFiltered.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => selectTimeSlot(slot)}
                    className="w-full rounded-lg p-3 text-left font-medium"
                    style={{ backgroundColor: C.elevation2, color: C.text }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="mt-6 w-full text-center text-sm underline"
              style={{ color: C.textSecondary }}
              onClick={() => {
                setValidationError(null);
                setStep('date');
              }}
            >
              Back to date
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className={cn(cardClass)} style={cardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              Confirm booking
            </h1>

            <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: C.elevation2 }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSecondary }}>
                Address
              </p>
              <p className="font-semibold" style={{ color: C.text }}>
                {selectedAddress?.label ?? '—'}
              </p>
              <p className="text-sm" style={{ color: C.textSecondary }}>
                {[selectedAddress?.addressLine, selectedAddress?.pincode].filter(Boolean).join(', ') || '—'}
              </p>
              {slotQuery.data?.branchName ? (
                <div className="mt-3 flex justify-between gap-2 text-sm">
                  <span style={{ color: C.textSecondary }}>Branch</span>
                  <span className="font-semibold" style={{ color: C.text }}>
                    {slotQuery.data.branchName}
                  </span>
                </div>
              ) : null}
              <div className="mt-3 flex justify-between gap-2 text-sm">
                <span style={{ color: C.textSecondary }}>Date</span>
                <span className="font-semibold" style={{ color: C.text }}>
                  {formatConfirmDate(pickupDate)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-2 text-sm">
                <span style={{ color: C.textSecondary }}>Time</span>
                <span className="font-semibold" style={{ color: C.text }}>
                  {formatConfirmTime(timeWindow)}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSecondary }}>
                Services
              </p>
              <p className="font-medium" style={{ color: C.text }}>
                {isSubscriptionFlow
                  ? 'Booking with subscription'
                  : selectedServiceIds
                      .map((id) => CUSTOMER_FLOW_SERVICE_TYPES.find((s) => s.id === id)?.label ?? id)
                      .join(', ')}
              </p>
            </div>

            {!isSubscriptionFlow ? (
              <label className="mt-4 block">
                <span className="mb-1 block text-sm font-medium" style={{ color: C.text }}>
                  Estimated weight (kg) <span style={{ color: C.textSecondary }}>(optional)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={estimatedWeightKg}
                  onChange={(e) => setEstimatedWeightKg(e.target.value)}
                  className="h-11 w-full rounded-lg border px-3 focus-visible:outline-none focus-visible:border-[var(--customer-primary,#C2185B)] focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#C2185B)]"
                  style={{ borderColor: C.borderLight, backgroundColor: C.elevation2 }}
                />
              </label>
            ) : null}

            {validationError ? (
              <p className="mt-3 text-sm font-medium" style={{ color: C.error }}>
                {validationError}
              </p>
            ) : null}

            <button
              type="button"
              className={cn(primaryBtn, 'mt-6')}
              style={{ backgroundColor: 'var(--customer-primary, #C2185B)' }}
              disabled={createOrder.isPending}
              onClick={handleConfirmSubmit}
            >
              {createOrder.isPending ? 'Booking…' : 'Submit'}
            </button>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm underline"
              style={{ color: C.textSecondary }}
              onClick={() => {
                setValidationError(null);
                setStep('time');
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


