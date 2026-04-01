'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useOrderSummary } from '@/hooks/useOrderSummary';
import { useUpdateOrderStatus } from '@/hooks/useOrderStatus';
import { useCreateAckDraft, useIssueAck, useCreateFinalDraft, useIssueFinal } from '@/hooks/useInvoice';
import { useCatalogItemsWithPrices, useCatalogItemsWithMatrix } from '@/hooks/useCatalog';
import { useBranding } from '@/hooks/useBranding';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useUpdatePayment } from '@/hooks/usePayments';
import { OrderStatusBadge, PaymentStatusBadge, InvoiceStatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceBuilder, type InvoiceLineRow } from '@/components/forms/InvoiceBuilder';
import { formatMoney, formatDate, getGoogleMapsUrl, getTodayLocalDateKey } from '@/lib/format';
import { getApiOrigin, getFriendlyErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { computeSubscriptionPreview, parseAckItems, parseAckKg } from '@/lib/subscription-preview';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import type { OrderStatus, InvoiceOrderMode, PaymentProvider } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

const STATUS_FLOW: OrderStatus[] = [
  'BOOKING_CONFIRMED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

type OrderTab = 'ack' | 'final' | 'payment';

export default function OrderDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const orderId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';

  const { data: summary, isLoading, error } = useOrderSummary(orderId || null);
  const updateStatus = useUpdateOrderStatus(orderId);
  const createAckDraft = useCreateAckDraft(orderId);
  const issueAck = useIssueAck(orderId);
  const createFinalDraft = useCreateFinalDraft(orderId);
  const issueFinal = useIssueFinal(orderId);
  const updatePayment = useUpdatePayment(orderId);
  const { data: catalog } = useCatalogItemsWithPrices();
  const { data: catalogMatrixData } = useCatalogItemsWithMatrix();
  const { data: branding } = useBranding();
  const { data: subscriptionPlans } = useSubscriptionPlans();
  const branchId = summary?.branch?.id ?? null;
  const catalogMatrix = catalogMatrixData
    ? {
        items: branchId
          ? catalogMatrixData.items.filter(
              (item) => !item.branchIds?.length || item.branchIds.includes(branchId),
            )
          : catalogMatrixData.items,
        serviceCategories: catalogMatrixData.serviceCategories,
        segmentCategories: catalogMatrixData.segmentCategories ?? [],
      }
    : undefined;

  const [ackOrderMode, setAckOrderMode] = useState<InvoiceOrderMode>('INDIVIDUAL');
  const [ackItems, setAckItems] = useState<InvoiceLineRow[]>([]);
  const [ackTaxPercent, setAckTaxPercent] = useState(0);
  const [ackDiscountType, setAckDiscountType] = useState<'percent' | 'amount'>('amount');
  const [ackDiscountValue, setAckDiscountValue] = useState(0);
  const [ackComments, setAckComments] = useState('Thank you');
  const [ackWeightKg, setAckWeightKg] = useState<number | ''>('');
  const [ackItemsCount, setAckItemsCount] = useState<number | ''>('');
  const [ackNewSubscriptionPlanId, setAckNewSubscriptionPlanId] = useState('');
  const [ackNewSubscriptionStartDate, setAckNewSubscriptionStartDate] = useState(() => getTodayLocalDateKey());
  const [ackNewSubscriptionQuantityMonths, setAckNewSubscriptionQuantityMonths] = useState<number>(1);
  type NewSubEntry = { id: string; planId: string; validityStartDate: string; quantityMonths: number };
  const [ackNewSubscriptions, setAckNewSubscriptions] = useState<NewSubEntry[]>([]);
  const hasPrefilledFinal = useRef(false);
  const hasHydratedAck = useRef(false);
  const hasHydratedFinal = useRef(false);
  const ackPrintAreaRef = useRef<HTMLDivElement>(null);
  const finalPrintAreaRef = useRef<HTMLDivElement>(null);
  const [editingFinal, setEditingFinal] = useState(false);
  const [finalItems, setFinalItems] = useState<InvoiceLineRow[]>([]);
  const [finalWeightKg, setFinalWeightKg] = useState<number | ''>('');
  const [finalItemsCount, setFinalItemsCount] = useState<number | ''>('');
  const [finalTaxPercent, setFinalTaxPercent] = useState(0);
  const [finalDiscountType, setFinalDiscountType] = useState<'percent' | 'amount'>('amount');
  const [finalDiscountValue, setFinalDiscountValue] = useState(0);
  const [finalComments, setFinalComments] = useState('Thank for opting our services');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('UPI');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [orderTab, setOrderTab] = useState<OrderTab>('ack');
  // Hydrate ACK form from saved invoice when summary loads; or default order mode from order type
  useEffect(() => {
    if (!summary) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const ack = invList.find((i) => i.type === 'ACKNOWLEDGEMENT');
    if (ack) {
      if (!hasHydratedAck.current) {
        hasHydratedAck.current = true;
        setAckOrderMode((ack.orderMode as InvoiceOrderMode) || 'INDIVIDUAL');
        if (ack.items?.length) {
          setAckItems(
            ack.items.map((i) => ({
              type: (i.type || 'SERVICE') as InvoiceLineRow['type'],
              name: i.name,
              quantity: i.quantity,
              unitPricePaise: i.unitPrice,
              amountPaise: i.amount,
              catalogItemId: i.catalogItemId ?? undefined,
              segmentCategoryId: i.segmentCategoryId ?? undefined,
              serviceCategoryId: i.serviceCategoryId ?? undefined,
            })),
          );
        }
        if (ack.subtotal != null && ack.tax != null) {
          setAckTaxPercent(ack.subtotal > 0 ? Math.round((ack.tax / ack.subtotal) * 1000) / 10 : 0);
        }
        setAckDiscountType('amount');
        setAckDiscountValue(ack.discountPaise ?? 0);
        setAckComments(ack.comments ?? 'Thank you');
        const rawSnap = ack.newSubscriptionSnapshotJson;
        if (rawSnap) {
          type Snap = { planId: string; validityStartDate: string; quantityMonths?: number };
          const list: Snap[] = Array.isArray(rawSnap) ? rawSnap as Snap[] : (rawSnap as Snap).planId ? [rawSnap as Snap] : [];
          setAckNewSubscriptions(
            list.map((s, i) => ({
              id: `hydrated-${ack.id}-${i}`,
              planId: s.planId,
              validityStartDate: s.validityStartDate,
              quantityMonths: typeof (s as { quantityMonths?: number }).quantityMonths === 'number' ? (s as { quantityMonths: number }).quantityMonths : 1,
            }))
          );
        }
      }
    } else if (summary.order.orderType === 'SUBSCRIPTION' || summary.order.orderType === 'BOTH') {
      setAckOrderMode('SUBSCRIPTION_ONLY');
    }
  }, [summary]);

  // Hydrate final invoice form from saved final invoice when it exists; else prefill from ACK once
  useEffect(() => {
    if (!summary || hasPrefilledFinal.current) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const finalInv = invList.find((i) => i.type === 'FINAL');
    const ack = invList.find((i) => i.type === 'ACKNOWLEDGEMENT');
    if (finalInv?.items?.length) {
      hasPrefilledFinal.current = true;
      hasHydratedFinal.current = true;
      setFinalItems(
        finalInv.items
          .filter((i) => i.name !== 'Subscription usage')
          .map((i) => ({
          type: (i.type || 'SERVICE') as InvoiceLineRow['type'],
          name: i.name,
          quantity: i.quantity,
          unitPricePaise: i.unitPrice,
          amountPaise: i.amount,
          catalogItemId: i.catalogItemId ?? undefined,
          segmentCategoryId: i.segmentCategoryId ?? undefined,
          serviceCategoryId: i.serviceCategoryId ?? undefined,
        })),
      );
      const kg = (finalInv as { subscriptionUsageKg?: number | null }).subscriptionUsageKg;
      const items = (finalInv as { subscriptionUsageItems?: number | null }).subscriptionUsageItems;
      setFinalWeightKg(kg != null ? kg : (finalInv.items[0]?.quantity ?? ''));
      setFinalItemsCount(items != null ? items : '');
      if (finalInv.subtotal != null && finalInv.tax != null && finalInv.subtotal > 0) {
        setFinalTaxPercent(Math.round((finalInv.tax / finalInv.subtotal) * 1000) / 10);
      }
      setFinalDiscountType('amount');
      setFinalDiscountValue(finalInv.discountPaise ?? 0);
      setFinalComments(finalInv.comments ?? '');
    } else if (ack) {
      hasPrefilledFinal.current = true;
      const ackItems = ack?.items;
      if (ackItems?.length) {
        setFinalItems(
          ackItems.map((i) => ({
            type: (i.type || 'SERVICE') as InvoiceLineRow['type'],
            name: i.name,
            quantity: i.quantity,
            unitPricePaise: i.unitPrice,
            amountPaise: i.amount,
            catalogItemId: i.catalogItemId ?? undefined,
            segmentCategoryId: i.segmentCategoryId ?? undefined,
            serviceCategoryId: i.serviceCategoryId ?? undefined,
          })),
        );
      }
      const ackKg = (ack as { subscriptionUsageKg?: number | null }).subscriptionUsageKg;
      const ackItemsCount = (ack as { subscriptionUsageItems?: number | null }).subscriptionUsageItems;
      setFinalWeightKg(ackKg != null ? ackKg : (ackItems?.[0]?.quantity ?? ''));
      setFinalItemsCount(ackItemsCount != null ? ackItemsCount : '');
      if (ack.subtotal != null && ack.tax != null && ack.subtotal > 0) {
        setFinalTaxPercent(Math.round((ack.tax / ack.subtotal) * 1000) / 10);
      }
      setFinalDiscountType(ackDiscountType);
      setFinalDiscountValue(
        ackDiscountType === 'percent' && (ack.subtotal ?? 0) > 0 && (ack.discountPaise ?? 0) > 0
          ? Math.round(((ack.discountPaise ?? 0) / ack.subtotal!) * 100)
          : (ack.discountPaise ?? 0)
      );
    }
  }, [summary, ackDiscountType]);

  // After ACK is submitted (ISSUED), sync Final invoice form from ACK so "same is added to Final Invoices"
  useEffect(() => {
    if (!summary) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const ack = invList.find((i) => i.type === 'ACKNOWLEDGEMENT');
    const finalInv = invList.find((i) => i.type === 'FINAL');
    if (ack?.status !== 'ISSUED' || finalInv?.items?.length) return;

    const ackKg = (ack as { subscriptionUsageKg?: number | null }).subscriptionUsageKg;
    const ackItemsCount = (ack as { subscriptionUsageItems?: number | null }).subscriptionUsageItems;

    if (ack.items?.length) {
      setFinalItems(
        ack.items.map((i) => ({
          type: (i.type || 'SERVICE') as InvoiceLineRow['type'],
          name: i.name,
          quantity: i.quantity,
          unitPricePaise: i.unitPrice,
          amountPaise: i.amount,
          catalogItemId: i.catalogItemId ?? undefined,
          segmentCategoryId: i.segmentCategoryId ?? undefined,
          serviceCategoryId: i.serviceCategoryId ?? undefined,
        })),
      );
    } else if (ackKg != null && Number(ackKg) > 0) {
      // Subscription-only ACK: no line item on final invoice; admin sets final weight in the input next to subscription summary
      setFinalItems([]);
    }

    setFinalWeightKg(ackKg != null ? ackKg : (ack.items?.[0]?.quantity ?? ''));
    setFinalItemsCount(ackItemsCount != null ? ackItemsCount : '');
    if (ack.subtotal != null && ack.tax != null && ack.subtotal > 0) {
      setFinalTaxPercent(Math.round((ack.tax / ack.subtotal) * 1000) / 10);
    }
    setFinalDiscountType(ackDiscountType);
    setFinalDiscountValue(
      ackDiscountType === 'percent' && (ack.subtotal ?? 0) > 0 && (ack.discountPaise ?? 0) > 0
        ? Math.round(((ack.discountPaise ?? 0) / ack.subtotal!) * 100)
        : (ack.discountPaise ?? 0)
    );
    setFinalComments(ack.comments ?? '');
  }, [summary, ackDiscountType]);

  // Prefill payment amount from final invoice total when order is delivered
  useEffect(() => {
    if (!summary || summary.order?.status !== 'DELIVERED') return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const total = invList.find((i) => i.type === 'FINAL')?.total;
    if (total != null && total > 0 && paymentAmountRupees === '') {
      setPaymentAmountRupees(total / 100);
    }
  }, [summary, paymentAmountRupees]);

  if (!orderId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Order ID is missing. Go back to the dashboard or orders list.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">← Dashboard</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-destructive">Failed to load order.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const order = summary?.order;
  if (!order) {
    return (
      <div>
        <p className="text-sm text-destructive">Order data is missing from the response.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline mt-2 inline-block">← Dashboard</Link>
      </div>
    );
  }

  const invoices = Array.isArray(summary.invoices) ? summary.invoices : [];
  const ackInvoice = invoices.find((i) => i.type === 'ACKNOWLEDGEMENT');
  const finalInvoice = invoices.find((i) => i.type === 'FINAL');
  const customer = summary.customer ?? { id: '', name: null, phone: null, email: null };
  const address = summary.address ?? { id: '', label: '', addressLine: '', pincode: '', googleMapUrl: null };
  const mapsUrl = getGoogleMapsUrl(address.googleMapUrl);
  const isDelivered = order.status === 'DELIVERED';
  const canIssueFinalInvoice =
    order.status === 'OUT_FOR_DELIVERY' ||
    order.status === 'DELIVERED';
  const ackSubmitted = ackInvoice?.status === 'ISSUED';
  const finalSubmitted = finalInvoice?.status === 'ISSUED';
  const paymentRecorded = summary.payment?.status === 'CAPTURED';
  const showTabs = ackSubmitted;
  const isAckEditable = ackSubmitted && !finalSubmitted;
  const isLocked = ackInvoice?.status === 'ISSUED';
  const isFinalLocked = paymentRecorded;
  const hasSubscription = !!(summary.subscription || summary.subscriptionUsage);

  // When ACK is submitted, switch to Final tab; when Final is submitted, switch to Payment tab
  const prevAckSubmitted = useRef(false);
  const prevFinalSubmitted = useRef(false);
  useEffect(() => {
    if (!summary) return;
    if (ackSubmitted && !prevAckSubmitted.current) setOrderTab('final');
    if (finalSubmitted && !prevFinalSubmitted.current) setOrderTab('payment');
    prevAckSubmitted.current = ackSubmitted;
    prevFinalSubmitted.current = finalSubmitted;
  }, [summary, ackSubmitted, finalSubmitted]);

  /** ACK weight/items for this order (from issued ACK invoice). Acknowledgement invoice is immutable once submitted. */
  const ackKgForOrder = ackInvoice && (ackInvoice as { subscriptionUsageKg?: number | null }).subscriptionUsageKg != null ? Number((ackInvoice as { subscriptionUsageKg?: number | null }).subscriptionUsageKg) : null;
  const ackItemsForOrder = ackInvoice && (ackInvoice as { subscriptionUsageItems?: number | null }).subscriptionUsageItems != null ? Number((ackInvoice as { subscriptionUsageItems?: number | null }).subscriptionUsageItems) : null;
  /** Final draft weight/items: form state or saved draft. When admin saves final draft, display reflects this until Submit. */
  const finalKgForDisplay = (finalWeightKg !== '' && finalWeightKg !== undefined) ? Number(finalWeightKg) : (finalInvoice && (finalInvoice as { subscriptionUsageKg?: number | null }).subscriptionUsageKg != null ? Number((finalInvoice as { subscriptionUsageKg?: number | null }).subscriptionUsageKg) : null);
  const finalItemsForDisplay = (finalItemsCount !== '' && finalItemsCount !== undefined) ? Number(finalItemsCount) : (finalInvoice && (finalInvoice as { subscriptionUsageItems?: number | null }).subscriptionUsageItems != null ? Number((finalInvoice as { subscriptionUsageItems?: number | null }).subscriptionUsageItems) : null);
  /** Effective subscription usage for display when final draft exists: backend used − ACK + final draft. Left side and green bar use this so saving 4.5 kg shows 4.5 until Submit. */
  const sub = summary.subscription;
  const effectiveUsedKg = sub?.kgLimit != null && ackKgForOrder != null
    ? Number(sub.usedKg ?? 0) - ackKgForOrder + (finalKgForDisplay ?? ackKgForOrder)
    : Number(sub?.usedKg ?? 0);
  const effectiveUsedItems = sub?.itemsLimit != null && ackItemsForOrder != null
    ? (sub.usedItemsCount ?? 0) - ackItemsForOrder + (finalItemsForDisplay ?? ackItemsForOrder)
    : (sub?.usedItemsCount ?? 0);

  const ackSubtotal = (items: InvoiceLineRow[]) =>
    items.reduce((s, i) => s + (i.amountPaise ?? i.quantity * i.unitPricePaise), 0);
  const hasNewSubscriptionSelected =
    (ackOrderMode === 'SUBSCRIPTION_ONLY' || ackOrderMode === 'BOTH') && ackNewSubscriptions.length > 0;
  const ackSubscriptionAmountPaise = ackNewSubscriptions.reduce(
    (sum, entry) => sum + (subscriptionPlans?.find((p) => p.id === entry.planId)?.pricePaise ?? 0) * entry.quantityMonths,
    0
  );
  const toAckDraftBody = (
    items: InvoiceLineRow[],
    taxPercent: number,
    discountType: 'percent' | 'amount',
    discountValue: number,
    comments: string,
    subscriptionAmountPaise?: number
  ) => {
    const mode = ackOrderMode;
    const itemsSubtotal = mode === 'SUBSCRIPTION_ONLY' ? 0 : ackSubtotal(items);
    const combinedSubtotal = itemsSubtotal + (subscriptionAmountPaise ?? 0);
    const subtotal = hasNewSubscriptionSelected ? combinedSubtotal : itemsSubtotal;
    const taxPaise = mode === 'SUBSCRIPTION_ONLY' && !(subscriptionAmountPaise && subscriptionAmountPaise > 0) ? 0 : Math.round(subtotal * taxPercent / 100);
    const discountPaise =
      mode === 'SUBSCRIPTION_ONLY' && !(subscriptionAmountPaise && subscriptionAmountPaise > 0)
        ? 0
        : discountType === 'percent'
          ? Math.round(subtotal * discountValue / 100)
          : discountValue;
    const commentsWithBillNote = (comments?.trim() || 'Thank you') || undefined;
    const base = {
      orderMode: mode,
      items:
        mode === 'SUBSCRIPTION_ONLY'
          ? []
          : items.map((i) => ({
              type: i.type,
              name: i.name,
              quantity: i.quantity,
              unitPricePaise: i.unitPricePaise,
              amountPaise: i.amountPaise ?? i.quantity * i.unitPricePaise,
              catalogItemId: i.catalogItemId,
              segmentCategoryId: i.segmentCategoryId,
              serviceCategoryId: i.serviceCategoryId,
            })),
      taxPaise,
      discountPaise,
      comments: commentsWithBillNote,
    };
    if ((mode === 'SUBSCRIPTION_ONLY' || mode === 'BOTH') && ackNewSubscriptions.length > 0) {
      return {
        ...base,
        newSubscriptions: ackNewSubscriptions.map(({ planId, validityStartDate, quantityMonths }) => ({
          planId,
          validityStartDate,
          quantityMonths,
        })),
      };
    }
    if (mode === 'SUBSCRIPTION_ONLY' && order.subscriptionId) {
      return {
        ...base,
        subscriptionUtilized: true,
        subscriptionId: order.subscriptionId,
        subscriptionUsageSubscriptionIds: [order.subscriptionId],
        subscriptionUsageKg: ackWeightKg !== '' ? ackWeightKg : undefined,
        subscriptionUsageItems: ackItemsCount !== '' ? ackItemsCount : undefined,
      };
    }
    if (mode === 'BOTH' && order.subscriptionId) {
      return {
        ...base,
        subscriptionUtilized: true,
        subscriptionId: order.subscriptionId,
        subscriptionUsageSubscriptionIds: [order.subscriptionId],
        subscriptionUsageKg: ackWeightKg !== '' ? ackWeightKg : undefined,
        subscriptionUsageItems: ackItemsCount !== '' ? ackItemsCount : undefined,
      };
    }
    if (mode === 'INDIVIDUAL' && order.subscriptionId) {
      return { ...base, subscriptionId: undefined, subscriptionUtilized: false };
    }
    return base;
  };
  const finalSubtotal = (items: InvoiceLineRow[]) =>
    items.reduce((s, i) => s + (i.amountPaise ?? i.quantity * i.unitPricePaise), 0);
  const toFinalDraftBody = (
    items: InvoiceLineRow[],
    taxPercent: number,
    discountType: 'percent' | 'amount',
    discountValue: number,
    comments: string,
    weightKg?: number | '',
    itemsCount?: number | ''
  ) => {
    const filteredItems = items.filter((i) => i.name !== 'Subscription usage');
    const subtotal = finalSubtotal(filteredItems);
    const taxPaise = Math.round(subtotal * taxPercent / 100);
    const discountPaise = discountType === 'percent' ? Math.round(subtotal * discountValue / 100) : discountValue;
    const sub = summary?.subscription;
    const subscriptionUsageKg = hasSubscription && sub?.kgLimit != null && weightKg !== '' && weightKg !== undefined ? Number(weightKg) : undefined;
    const subscriptionUsageItems = hasSubscription && sub?.itemsLimit != null && itemsCount !== '' && itemsCount !== undefined ? Number(itemsCount) : undefined;
    return {
      items: filteredItems.map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        amountPaise: i.amountPaise ?? i.quantity * i.unitPricePaise,
        catalogItemId: i.catalogItemId,
        segmentCategoryId: i.segmentCategoryId,
        serviceCategoryId: i.serviceCategoryId,
      })),
      taxPaise,
      discountPaise,
      comments: comments || undefined,
      ...(subscriptionUsageKg !== undefined && { subscriptionUsageKg }),
      ...(subscriptionUsageItems !== undefined && { subscriptionUsageItems }),
    };
  };

  const defaultAckBody = () =>
    toAckDraftBody(
      [
        { type: 'SERVICE', name: 'Wash & Fold', quantity: 1, unitPricePaise: 10000, amountPaise: 10000 },
        { type: 'FEE', name: 'Pickup fee', quantity: 1, unitPricePaise: 2000, amountPaise: 2000 },
      ],
      0,
      'amount',
      0,
      ''
    );
  const defaultFinalBody = () =>
    toFinalDraftBody(
      [
        { type: 'SERVICE', name: 'Wash & Fold', quantity: 1, unitPricePaise: 10000, amountPaise: 10000 },
        { type: 'FEE', name: 'Delivery fee', quantity: 1, unitPricePaise: 1500, amountPaise: 1500 },
      ],
      0,
      'amount',
      0,
      ''
    );

  const runToDelivered = () => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) {
      if (order.status === 'DELIVERED') toast.info('Already delivered');
      return;
    }
    const next = STATUS_FLOW[idx + 1];
    updateStatus.mutate(next, {
      onSuccess: () => toast.success(`Status → ${next}`),
      onError: (e) => toast.error(e.message),
    });
  };

  const openFinalPdf = () => {
    if (finalInvoice?.pdfUrl) {
      const origin = getApiOrigin();
      const url = finalInvoice.pdfUrl.startsWith('http') ? finalInvoice.pdfUrl : `${origin}${finalInvoice.pdfUrl}`;
      window.open(url, '_blank');
    } else {
      toast.error('No FINAL invoice PDF yet');
    }
  };

  const recordPayment = () => {
    const amountPaise = paymentAmountRupees === '' ? 0 : Math.round(Number(paymentAmountRupees) * 100);
    if (amountPaise <= 0) {
      toast.error('Amount comes from Final invoice and cannot be zero.');
      return;
    }
    updatePayment.mutate(
      { provider: paymentProvider, status: 'CAPTURED', amountPaise, note: paymentNote || undefined },
      { onSuccess: () => toast.success('Payment recorded'), onError: (e) => toast.error(e.message) }
    );
  };

  const onAckIssueSuccess = () => {
    if (order.status === 'BOOKING_CONFIRMED' || order.status === 'PICKUP_SCHEDULED') {
      updateStatus.mutate('PICKED_UP', {
        onSuccess: () => toast.success('ACK submitted; status set to Picked up'),
        onError: (e) => toast.error(e.message),
      });
    } else {
      toast.success('ACK invoice submitted');
    }
  };

  const quickIssueAck = () => {
    const useNewSub = hasNewSubscriptionSelected;
    const body = useNewSub || ackItems.length
      ? toAckDraftBody(ackItems, ackTaxPercent, ackDiscountType, ackDiscountValue, ackComments, useNewSub ? ackSubscriptionAmountPaise : undefined)
      : defaultAckBody();
    createAckDraft.mutate(body, {
      onSuccess: () => {
        issueAck.mutate(
          {
            applySubscription: ackOrderMode !== 'INDIVIDUAL' && (!!order.subscriptionId || ackOrderMode === 'SUBSCRIPTION_ONLY'),
            weightKg: ackWeightKg !== '' ? ackWeightKg : undefined,
            itemsCount: ackItemsCount !== '' ? ackItemsCount : undefined,
          },
          {
            onSuccess: onAckIssueSuccess,
            onError: (e) => toast.error(e.message),
          },
        );
      },
      onError: (e) => toast.error(e.message),
    });
  };

  /** Single click: save ACK draft → issue ACK → set status to PICKED_UP. */
  const confirmPickup = () => {
    const useNewSub = hasNewSubscriptionSelected;
    const body = ackOrderMode === 'SUBSCRIPTION_ONLY' || useNewSub || ackItems.length
      ? toAckDraftBody(ackItems, ackTaxPercent, ackDiscountType, ackDiscountValue, ackComments, useNewSub ? ackSubscriptionAmountPaise : undefined)
      : defaultAckBody();
    createAckDraft.mutate(body, {
      onSuccess: () => {
        issueAck.mutate(
          {
            applySubscription: ackOrderMode !== 'INDIVIDUAL' && (!!order.subscriptionId || ackOrderMode === 'SUBSCRIPTION_ONLY'),
            weightKg: ackWeightKg !== '' ? ackWeightKg : undefined,
            itemsCount: ackItemsCount !== '' ? ackItemsCount : undefined,
          },
          {
            onSuccess: () => {
              updateStatus.mutate('PICKED_UP', {
                onSuccess: () => toast.success('Pickup confirmed and ACK submitted'),
                onError: (e) => toast.error(e.message),
              });
            },
            onError: (e) => toast.error(e.message),
          },
        );
      },
      onError: (e) => toast.error(e.message),
    });
  };
  const quickIssueFinal = () => {
    // Use current form state (prefilled from ACK) so tax and discount match ACK invoice exactly
    const body =
      finalItems.length > 0
        ? toFinalDraftBody(finalItems, finalTaxPercent, finalDiscountType, finalDiscountValue, finalComments, finalWeightKg, finalItemsCount)
        : toFinalDraftBody([], finalTaxPercent, finalDiscountType, finalDiscountValue, finalComments, finalWeightKg, finalItemsCount);
    createFinalDraft.mutate(body, {
      onSuccess: () => {
        issueFinal.mutate(undefined, {
          onSuccess: () => toast.success('FINAL invoice submitted'),
          onError: (e) => toast.error(e.message),
        });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const timelineStages: { key: OrderStatus; label: string; ts: string | null }[] = [
    { key: 'BOOKING_CONFIRMED', label: 'Order initiated', ts: order.createdAt ?? null },
    { key: 'PICKED_UP', label: 'Picked up', ts: order.pickedUpAt ?? null },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', ts: order.outForDeliveryAt ?? null },
    { key: 'DELIVERED', label: 'Delivered', ts: order.deliveredAt ?? null },
  ];
  const currentStatusForFlow: OrderStatus =
    order.status === 'PICKUP_SCHEDULED'
      ? 'BOOKING_CONFIRMED'
      : (order.status === 'IN_PROCESSING' || order.status === 'READY')
        ? 'PICKED_UP'
        : order.status;
  const currentIdx = STATUS_FLOW.indexOf(currentStatusForFlow);
  const canConfirmOrder = order.status === 'BOOKING_CONFIRMED';
  const hasSubscriptionUsage = (ackWeightKg !== '' && Number(ackWeightKg) > 0) || (ackItemsCount !== '' && Number(ackItemsCount) > 0);
  /** Order is dedicated to one subscription; we use summary.subscription (order's subscription). */
  const hasExistingSubscriptionSelected = ackOrderMode !== 'INDIVIDUAL' && !!summary.subscription;
  const subscriptionUsageRequired =
    (ackOrderMode === 'SUBSCRIPTION_ONLY' && !!order.subscriptionId) ||
    (ackOrderMode === 'BOTH' && hasExistingSubscriptionSelected);
  const effectiveSubsForLimits = summary.subscription
    ? [{ kgLimit: summary.subscription.kgLimit, itemsLimit: summary.subscription.itemsLimit }]
    : [];
  const subscriptionRequiresWeight = effectiveSubsForLimits.some((s) => s.kgLimit != null);
  const subscriptionRequiresItems = effectiveSubsForLimits.some((s) => s.itemsLimit != null);
  /** Single source of truth: subscription utilisation after this ACK (live as admin types). When ACK is already issued, do not add form weight/items again – backend usedKg/usedItemsCount already include them. */
  const ackSubscriptionPreview = summary.subscription
    ? computeSubscriptionPreview({
        pickupLimit: summary.subscription.maxPickups,
        usedPickups: summary.subscription.maxPickups - summary.subscription.remainingPickups,
        itemLimit: summary.subscription.itemsLimit ?? null,
        usedItems: summary.subscription.usedItemsCount ?? 0,
        kgLimit: summary.subscription.kgLimit ?? null,
        usedKg: Number(summary.subscription.usedKg ?? 0),
        ackItems: isLocked ? 0 : parseAckItems(ackItemsCount),
        ackKg: isLocked ? 0 : parseAckKg(ackWeightKg),
        applySubscription: isLocked ? false : !!hasExistingSubscriptionSelected,
      })
    : null;
  const validSubscriptionUsage =
    (!subscriptionRequiresWeight || (ackWeightKg !== '' && Number(ackWeightKg) > 0)) &&
    (!subscriptionRequiresItems || (ackItemsCount !== '' && Number(ackItemsCount) > 0));
  const pickupCanSave =
    ackOrderMode === 'SUBSCRIPTION_ONLY'
      ? validSubscriptionUsage || (hasNewSubscriptionSelected && !!ackNewSubscriptionPlanId && !!ackNewSubscriptionStartDate)
      : ackOrderMode === 'INDIVIDUAL'
        ? ackItems.length > 0
        : ackOrderMode === 'BOTH'
          ? ackItems.length > 0 || (hasExistingSubscriptionSelected && validSubscriptionUsage) || hasNewSubscriptionSelected
          : false;

  const formatTs = (s: string | null) => (s ? formatDate(s) + (s.includes('T') ? ' ' + new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') : '—');

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print{body *{visibility:hidden}body:not(.print-final-invoice) .ack-invoice-print-area,body:not(.print-final-invoice) .ack-invoice-print-area *{visibility:visible}body.print-final-invoice .final-invoice-print-area,body.print-final-invoice .final-invoice-print-area *{visibility:visible}body.print-final-invoice .ack-invoice-print-area{visibility:hidden!important;display:none!important}.ack-invoice-print-area,.final-invoice-print-area{position:absolute;left:0;top:0;width:100%;padding:0!important;margin:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ack-invoice-print-area{background:#f3f4f6!important}.final-invoice-print-area{background:#fdf2f8!important}.ack-invoice-print-area input,.ack-invoice-print-area select,.ack-invoice-print-area textarea,.final-invoice-print-area input,.final-invoice-print-area select,.final-invoice-print-area textarea{border:none!important;background:transparent!important;box-shadow:none!important;appearance:none}.ack-invoice-print-area button,.ack-invoice-print-area .ack-print-hide,.ack-invoice-print-area .ack-print-hide-header,.final-invoice-print-area button,.final-invoice-print-area .ack-print-hide,.final-invoice-print-area .ack-print-hide-header{display:none!important}.ack-invoice-print-area > div,.final-invoice-print-area > div{padding-top:0.5rem!important;margin-top:0!important}.ack-invoice-print-area .ack-print-hide-header + div,.final-invoice-print-area .ack-print-hide-header + div{padding-top:0.5rem!important}header,footer,aside,nav,.fixed{visibility:hidden!important;display:none!important}}`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `.ack-invoice-print-area.pdf-capture button,.ack-invoice-print-area.pdf-capture .ack-print-hide,.ack-invoice-print-area.pdf-capture .ack-print-hide-header,.final-invoice-print-area.pdf-capture button,.final-invoice-print-area.pdf-capture .ack-print-hide,.final-invoice-print-area.pdf-capture .ack-print-hide-header{display:none!important}`,
        }}
      />
      <div className="space-y-6 pb-24">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground transition-colors">Customers</Link>
        <span aria-hidden>/</span>
        <Link href={customer.id ? `/customers/${customer.id}` : '#'} className="hover:text-foreground transition-colors">
          {customer.name ?? 'Customer'}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground font-medium">Order</span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold break-all font-mono">Order {order.id}</h1>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              order.orderType === 'SUBSCRIPTION'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {order.orderType === 'SUBSCRIPTION' ? 'Subscription' : 'Individual booking'}
          </span>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Status</CardTitle>
              <CardDescription>Horizontal timeline with timestamps</CardDescription>
            </div>
            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && ackInvoice?.status !== 'ISSUED' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel order
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-start">
              {timelineStages.map((stage, idx) => {
                const isReached = currentIdx >= idx;
                const isCurrent = order.status === stage.key;
                return (
                  <div key={stage.key} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center" style={{ minWidth: '90px' }}>
                      <div
                        className={cn(
                          'rounded px-2 py-1 text-center text-xs font-medium',
                          isCurrent ? 'bg-primary text-primary-foreground' : isReached ? 'bg-muted' : 'bg-muted/50 text-muted-foreground'
                        )}
                      >
                        {stage.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatTs(stage.ts)}</p>
                    </div>
                    {idx < timelineStages.length - 1 && (
                      <div className={cn('w-6 h-0.5 flex-shrink-0', isReached ? 'bg-muted' : 'bg-muted/50')} aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              Cancel this order before issuing the ACK invoice. No subscription deductions will be applied; summary will be recalculated. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium" htmlFor="cancel-reason">Reason (required)</label>
            <textarea
              id="cancel-reason"
              className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Customer requested cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || updateStatus.isPending}
              onClick={() => {
                updateStatus.mutate(
                  { status: 'CANCELLED', reason: cancelReason.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Order cancelled');
                      setCancelDialogOpen(false);
                      setCancelReason('');
                    },
                    onError: (e) => toast.error(getFriendlyErrorMessage(e)),
                  }
                );
              }}
            >
              {updateStatus.isPending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTabs && (
        <div className="flex flex-wrap gap-1 border-b border-muted pb-2 mb-2">
          <Button
            variant={orderTab === 'ack' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setOrderTab('ack')}
            className="rounded-b-none"
          >
            Acknowledgment Invoice
          </Button>
          <Button
            variant={orderTab === 'final' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setOrderTab('final')}
            className="rounded-b-none"
          >
            Final Invoice
          </Button>
          {finalSubmitted && (
            <Button
              variant={orderTab === 'payment' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setOrderTab('payment')}
              className="rounded-b-none"
            >
              Record Payment
            </Button>
          )}
        </div>
      )}

      {(!showTabs || orderTab === 'ack') && (
      <div ref={ackPrintAreaRef} className="ack-invoice-print-area rounded-lg p-4 bg-gray-100">
      {finalSubmitted && (
        <p className="text-sm text-muted-foreground mb-3 ack-print-hide">Acknowledgement invoice cannot be edited after Final invoice is submitted.</p>
      )}
      <Card className="bg-transparent border-0 shadow-none">
        <CardContent className="space-y-4 pt-6">
          {/* Header: centered logo only */}
          <div className="flex border-b pb-4 items-center justify-center">
            <div className="flex-shrink-0 flex justify-center">
              {branding?.logoUrl ? (
                <img
                  src={`${branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`}${(branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`).includes('?') ? '&' : '?'}v=${encodeURIComponent(branding.updatedAt)}`}
                  alt="Logo"
                  className="h-14 w-auto object-contain"
                />
              ) : (
                <div className="h-14 w-24 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">Logo</div>
              )}
            </div>
          </div>

          {/* Same line: Order details (left) | ACK number, PAN, GST, Branch & address (right) */}
          <div className="flex flex-wrap gap-4 items-start rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium mb-1">Order details</p>
              <p>{customer.name ?? '—'}</p>
              <p className="text-muted-foreground">Phone: {customer.phone ?? '—'}</p>
              {order.orderType === 'SUBSCRIPTION' ? (
                <p className="text-muted-foreground">
                  Subscription booking{summary.subscription?.planName ? ` (${summary.subscription.planName})` : ''}
                </p>
              ) : order.orderSource !== 'WALK_IN' && (
                <p className="text-muted-foreground">
                  Service: {(order.serviceTypes && order.serviceTypes.length > 0 ? order.serviceTypes : [order.serviceType]).map((s) => s.replace(/_/g, ' ')).join(', ')}
                </p>
              )}
              {order.orderSource !== 'WALK_IN' && (
                <p>
                  {address.addressLine}, {address.pincode}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline text-xs"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Map
                    </a>
                  ) : (
                    <span className="ml-1.5 text-xs text-muted-foreground">No Google Maps link saved</span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground">
                Pickup: {formatDate(order.pickupDate)} {order.timeWindow}
              </p>
              {ackInvoice && (
                <p className="text-xs text-muted-foreground mt-1">Acknowledgement Invoice ACK - {order.id}</p>
              )}
            </div>
            <div className="text-right text-muted-foreground space-y-0.5">
              {summary.branch?.panNumber && <p>PAN: {summary.branch.panNumber}</p>}
              {summary.branch?.gstNumber && <p>GST: {summary.branch.gstNumber}</p>}
              {summary.branch && (
                <>
                  <p className="font-medium text-foreground">{summary.branch.name}</p>
                  <p>{summary.branch.address}</p>
                  {summary.branch.phone ? <p>Phone: {summary.branch.phone}</p> : null}
                </>
              )}
            </div>
          </div>

          {/* Subscription details on invoice (order is dedicated to one subscription) */}
          {(ackOrderMode === 'SUBSCRIPTION_ONLY' || (order.subscriptionId && summary.subscription)) && summary.subscription && ackSubscriptionPreview && (() => {
              const sub = summary.subscription;
              const p = ackSubscriptionPreview;
              return (
                <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
                  <p className="font-medium mb-1.5">Subscription</p>
                  <p className="text-foreground">{sub.planName}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {[`${sub.maxPickups} pickups total`, sub.kgLimit != null ? `${sub.kgLimit} kg` : null, sub.itemsLimit != null ? `${sub.itemsLimit} items` : null, `Valid till ${formatDate(sub.expiryDate)}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-muted-foreground text-xs mt-2 font-medium">Utilised with this invoice</p>
                  <p className="text-foreground text-xs">
                    {p.previewUsedPickups} pickup{p.previewUsedPickups !== 1 ? 's' : ''}
                    {sub.kgLimit != null && <> · <span className={p.kgExceeded ? 'text-destructive font-medium' : ''}>{p.previewUsedKg}/{sub.kgLimit} kg</span>{p.kgExceeded && ' (exceeded)'}</>}
                    {sub.itemsLimit != null && <> · <span className={p.itemsExceeded ? 'text-destructive font-medium' : ''}>{p.previewUsedItems}/{sub.itemsLimit} items</span>{p.itemsExceeded && ' (exceeded)'}</>}
                  </p>
                  {!isLocked && ((p.kgExceeded && parseAckKg(ackWeightKg) > 0) || (p.itemsExceeded && parseAckItems(ackItemsCount) > 0)) && (
                    <p className="text-destructive text-xs font-medium mt-1.5">Exceeds subscription. Reduce weight or items to submit.</p>
                  )}
                </div>
              );
            })()}

          {hasExistingSubscriptionSelected && (ackOrderMode === 'SUBSCRIPTION_ONLY' || ackOrderMode === 'BOTH') && (
            <div className="mb-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-800 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-green-700 dark:text-green-300 font-medium" aria-hidden>✓</span>
                <span className="text-green-800 dark:text-green-200 font-medium">
                  {summary.subscription?.planName ?? '—'}
                </span>
                <span className="text-green-800 dark:text-green-200">
                  {isLocked ? (
                    /* When ACK already submitted: show subscription state as recorded (same as at ACK submit) – ref for future. */
                    <>
                      {summary.subscription != null ? `${summary.subscription.remainingPickups}/${summary.subscription.maxPickups} pickups left` : '—'}
                      {summary.subscription?.kgLimit != null && <> · {(summary.subscription.kgLimit ?? 0) - Number(summary.subscription.usedKg ?? 0)}/{summary.subscription.kgLimit} kg left</>}
                      {summary.subscription?.itemsLimit != null && <> · {(summary.subscription.itemsLimit ?? 0) - (summary.subscription.usedItemsCount ?? 0)}/{summary.subscription.itemsLimit} items left</>}
                      {' · Applied'}
                    </>
                  ) : ackSubscriptionPreview != null ? (
                    <>
                      {ackSubscriptionPreview.previewRemainingPickups}/{summary.subscription!.maxPickups} pickups left
                      {summary.subscription?.kgLimit != null && (
                        <> · <span className={ackSubscriptionPreview.kgExceeded ? 'text-destructive font-medium' : ''}>{ackSubscriptionPreview.previewRemainingKg ?? 0}/{summary.subscription.kgLimit} kg left</span>{ackSubscriptionPreview.kgExceeded && ' (exceeded)'}</>
                      )}
                      {summary.subscription?.itemsLimit != null && (
                        <> · <span className={ackSubscriptionPreview.itemsExceeded ? 'text-destructive font-medium' : ''}>{ackSubscriptionPreview.previewRemainingItems ?? 0}/{summary.subscription.itemsLimit} items left</span>{ackSubscriptionPreview.itemsExceeded && ' (exceeded)'}</>
                      )}
                    </>
                  ) : (
                    <>
                      {summary.subscription != null ? `${summary.subscription.remainingPickups}/${summary.subscription.maxPickups} pickups left` : '—'}
                      {summary.subscription?.kgLimit != null && <> · {Number(summary.subscription?.usedKg ?? 0)}/{summary.subscription.kgLimit} kg</>}
                      {summary.subscription?.itemsLimit != null && <> · {summary.subscription?.usedItemsCount ?? 0}/{summary.subscription.itemsLimit} items</>}
                    </>
                  )}
                  {!isLocked && summary.subscriptionUsage && ' · Applied'}
                </span>
                {subscriptionUsageRequired && !isLocked && (
                  <span className="flex items-center gap-3 ml-auto">
                    {subscriptionRequiresWeight && (
                      <label className="flex items-center gap-1.5 text-green-800 dark:text-green-200">
                        Weight (kg) <span className="text-destructive">*</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={ackWeightKg === '' ? '' : ackWeightKg}
                          onChange={(e) => setAckWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                          className={cn('w-20 rounded border border-green-300 dark:border-green-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm', (!ackWeightKg || Number(ackWeightKg) <= 0) && 'border-amber-500')}
                        />
                      </label>
                    )}
                    {subscriptionRequiresItems && (
                      <label className="flex items-center gap-1.5 text-green-800 dark:text-green-200">
                        Items <span className="text-destructive">*</span>
                        <input
                          type="number"
                          min={0}
                          value={ackItemsCount === '' ? '' : ackItemsCount}
                          onChange={(e) => setAckItemsCount(e.target.value === '' ? '' : Number(e.target.value))}
                          className={cn('w-20 rounded border border-green-300 dark:border-green-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm', (ackItemsCount === '' || Number(ackItemsCount) <= 0) && 'border-amber-500')}
                        />
                      </label>
                    )}
                  </span>
                )}
              </div>
              {subscriptionUsageRequired && !validSubscriptionUsage && !isLocked && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 pl-6">
                  {subscriptionRequiresWeight && !subscriptionRequiresItems && 'Enter weight (kg) to save.'}
                  {!subscriptionRequiresWeight && subscriptionRequiresItems && 'Enter items count to save.'}
                  {subscriptionRequiresWeight && subscriptionRequiresItems && 'Enter weight and items to save.'}
                </p>
              )}
              {!isLocked && ackSubscriptionPreview && ((ackSubscriptionPreview.kgExceeded && parseAckKg(ackWeightKg) > 0) || (ackSubscriptionPreview.itemsExceeded && parseAckItems(ackItemsCount) > 0)) && (
                <p className="text-xs text-destructive font-medium mt-1.5 pl-6">Exceeds subscription. Reduce weight or items to submit.</p>
              )}
              {ackSubscriptionPreview && !ackSubscriptionPreview.pickupsExceeded && !ackSubscriptionPreview.kgExceeded && !ackSubscriptionPreview.itemsExceeded && (ackSubscriptionPreview.previewRemainingPickups === 0 || ackSubscriptionPreview.previewRemainingKg === 0 || ackSubscriptionPreview.previewRemainingItems === 0) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 pl-6 font-medium">After this invoice subscription will become inactive.</p>
              )}
            </div>
          )}
          <InvoiceBuilder
            items={ackItems}
            subscriptionLines={ackNewSubscriptions.length > 0 ? ackNewSubscriptions.map((entry) => {
              const plan = subscriptionPlans?.find((p) => p.id === entry.planId);
              return { planName: plan?.name ?? entry.planId, startDate: entry.validityStartDate, quantity: entry.quantityMonths, unitPricePaise: plan?.pricePaise ?? 0 };
            }) : undefined}
            taxPaise={0}
            discountPaise={0}
            onItemsChange={setAckItems}
            onTaxChange={() => {}}
            onDiscountChange={() => {}}
            taxAsPercent={true}
            taxPercent={ackTaxPercent}
            onTaxPercentChange={setAckTaxPercent}
            discountAsPercentOrAmount={true}
            discountType={ackDiscountType}
            discountValue={ackDiscountValue}
            onDiscountTypeChange={setAckDiscountType}
            onDiscountValueChange={setAckDiscountValue}
            showPrepaidWhenZero={
              (() => {
                const subBased = ackOrderMode === 'SUBSCRIPTION_ONLY' || hasNewSubscriptionSelected || (ackOrderMode === 'BOTH' && hasExistingSubscriptionSelected);
                if (!subBased) return false;
                const s = (ackOrderMode === 'SUBSCRIPTION_ONLY' ? 0 : ackSubtotal(ackItems)) + (hasNewSubscriptionSelected ? ackSubscriptionAmountPaise : 0);
                return s + Math.round(s * ackTaxPercent / 100) - (ackDiscountType === 'percent' ? Math.round(s * ackDiscountValue / 100) : ackDiscountValue) <= 0;
              })()
            }
            comments={ackComments}
            onCommentsChange={setAckComments}
            onSaveDraft={() =>
              createAckDraft.mutate(toAckDraftBody(ackItems, ackTaxPercent, ackDiscountType, ackDiscountValue, ackComments, hasNewSubscriptionSelected ? ackSubscriptionAmountPaise : undefined))
            }
            onIssue={() => {
              const issueOpts = {
                applySubscription: ackOrderMode !== 'INDIVIDUAL' && (!!order.subscriptionId || ackOrderMode === 'SUBSCRIPTION_ONLY'),
                weightKg: ackWeightKg !== '' ? ackWeightKg : undefined,
                itemsCount: ackItemsCount !== '' ? ackItemsCount : undefined,
              };
              const onIssueError = (e: Error) => toast.error(getFriendlyErrorMessage(e));
              if (!ackInvoice) {
                createAckDraft.mutate(
                  toAckDraftBody(ackItems, ackTaxPercent, ackDiscountType, ackDiscountValue, ackComments, hasNewSubscriptionSelected ? ackSubscriptionAmountPaise : undefined),
                  {
                    onSuccess: () => {
                      issueAck.mutate(issueOpts, {
                        onSuccess: onAckIssueSuccess,
                        onError: onIssueError,
                      });
                    },
                    onError: (e) => toast.error(getFriendlyErrorMessage(e)),
                  },
                );
              } else {
                issueAck.mutate(issueOpts, {
                  onSuccess: onAckIssueSuccess,
                  onError: onIssueError,
                });
              }
            }}
            saveDraftLoading={createAckDraft.isPending}
            issueLoading={issueAck.isPending || createAckDraft.isPending}
            draftExists={!!ackInvoice}
            issued={isLocked || finalSubmitted}
            issueDisabled={finalSubmitted || (() => {
              if (ackSubscriptionPreview == null) return false;
              const kgOrItemsExceeded = ackSubscriptionPreview.kgExceeded || ackSubscriptionPreview.itemsExceeded;
              const lastInvoiceAllowed = summary.subscription?.remainingPickups === 0 && !kgOrItemsExceeded;
              return kgOrItemsExceeded || (ackSubscriptionPreview.pickupsExceeded && !lastInvoiceAllowed);
            })()}
            allowSubmitWithoutDraft={
              hasExistingSubscriptionSelected &&
              validSubscriptionUsage &&
              ackSubscriptionPreview != null &&
              !ackSubscriptionPreview.kgExceeded &&
              !ackSubscriptionPreview.itemsExceeded &&
              (!ackSubscriptionPreview.pickupsExceeded || (summary.subscription?.remainingPickups === 0))
            }
            onPrint={() => window.print()}
            showPrintOnly={true}
            pdfUrl={ackInvoice?.pdfUrl}
            whatsappShareMessage={ackInvoice?.pdfUrl ? `Acknowledgement Invoice ACK - ${order.id}: ${ackInvoice.pdfUrl.startsWith('http') ? ackInvoice.pdfUrl : `${getApiOrigin()}${ackInvoice.pdfUrl}`}` : undefined}
            printAreaRef={ackPrintAreaRef}
            catalog={catalog ?? undefined}
            catalogMatrix={catalogMatrix}
            orderMode={ackOrderMode}
            subscriptionOnlyCanSave={
              ackOrderMode === 'SUBSCRIPTION_ONLY' &&
              (hasNewSubscriptionSelected || (hasExistingSubscriptionSelected && validSubscriptionUsage))
            }
            saveDraftLabel="Save Ack Invoice"
            canSaveDraft={!finalSubmitted && (
              ackOrderMode === 'SUBSCRIPTION_ONLY'
                ? (!!order.subscriptionId && summary.subscription ? validSubscriptionUsage : false) || hasNewSubscriptionSelected
                : ackOrderMode === 'BOTH'
                  ? ackItems.length > 0 || (hasExistingSubscriptionSelected && validSubscriptionUsage) || hasNewSubscriptionSelected
                  : ackItems.length > 0
            )}
            subscriptionAmountPaise={hasNewSubscriptionSelected ? ackSubscriptionAmountPaise : undefined}
            showTaxAndDiscountWhenNewSubscription={ackOrderMode === 'SUBSCRIPTION_ONLY' && hasNewSubscriptionSelected}
          />
          {(() => {
            const itemsSt = ackSubtotal(ackItems);
            const st = (ackOrderMode === 'SUBSCRIPTION_ONLY' ? 0 : itemsSt) + (hasNewSubscriptionSelected ? ackSubscriptionAmountPaise : 0);
            const tax = Math.round(st * ackTaxPercent / 100);
            const disc = ackDiscountType === 'percent' ? Math.round(st * ackDiscountValue / 100) : ackDiscountValue;
            const ackTotal = st + tax - disc;
            const isSubscriptionBased = ackOrderMode === 'SUBSCRIPTION_ONLY' || hasNewSubscriptionSelected || (ackOrderMode === 'BOTH' && hasExistingSubscriptionSelected);
            const isPrepaid = ackTotal <= 0 && isSubscriptionBased;
            return (
              <>
                <div className="mt-4 pt-4 border-t space-y-1 text-right">
                  <p className="text-base">
                    Subtotal: {formatMoney(st)} · Tax ({ackTaxPercent}%): {formatMoney(tax)} · Discount {ackDiscountType === 'percent' ? `(${ackDiscountValue}%)` : `(₹)`}: -{formatMoney(disc)}
                  </p>
                  <p className="text-2xl font-bold">
                    {isPrepaid ? 'Prepaid' : `Total: ${formatMoney(ackTotal)}`}
                  </p>
                </div>
                {branding?.termsAndConditions?.trim() && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Terms and Conditions</p>
                    <div className="whitespace-pre-line">{branding.termsAndConditions.trim()}</div>
                  </div>
                )}
                <div className="mt-6 pt-4 text-center text-sm text-muted-foreground space-y-1">
                  {summary.branch?.footerNote?.trim() ? <p>{summary.branch.footerNote.trim()}</p> : null}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
      </div>
      )}

      {showTabs && orderTab === 'final' && (
      <div ref={finalPrintAreaRef} className="final-invoice-print-area rounded-lg p-4 bg-pink-50">
      <Card className="bg-transparent border-0 shadow-none">
        <CardHeader className="ack-print-hide-header">
          <div className="flex items-center justify-end gap-2">
            {finalInvoice?.status === 'ISSUED' && !editingFinal && !isFinalLocked && (
              <Button size="sm" variant="outline" className="ack-print-hide" onClick={() => setEditingFinal(true)}>
                Edit
              </Button>
            )}
            {isFinalLocked && (
              <p className="text-sm text-muted-foreground ack-print-hide">Final invoice cannot be edited after payment is collected.</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header: centered logo only */}
          <div className="flex border-b pb-4 items-center justify-center">
            <div className="flex-shrink-0 flex justify-center">
              {branding?.logoUrl ? (
                <img
                  src={`${branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`}${(branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`).includes('?') ? '&' : '?'}v=${encodeURIComponent(branding.updatedAt)}`}
                  alt="Logo"
                  className="h-14 w-auto object-contain"
                />
              ) : (
                <div className="h-14 w-24 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">Logo</div>
              )}
            </div>
          </div>

          {/* Invoice details (left) | Ref Acknowledgement details (right) – final invoice prepared with ref to ack */}
          <div className="flex flex-nowrap gap-4 items-start justify-between">
            <div className="min-w-0 rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm flex-shrink">
              <p className="font-medium mb-0.5">Invoice number</p>
              <p className="text-muted-foreground text-xs font-mono break-all">
                {finalInvoice ? `IN${order.id}` : '—'}
              </p>
              {finalInvoice?.issuedAt && (
                <p className="text-muted-foreground text-xs">
                  Issued: {formatDate(finalInvoice.issuedAt)}{finalInvoice.issuedAt.includes('T') ? ' ' + new Date(finalInvoice.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              )}
            </div>
            {ackInvoice && (
              <div className="text-right rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm shrink-0 min-w-0">
                <p className="font-medium mb-0.5">Ref Acknowledgement invoice</p>
                <p className="text-muted-foreground text-xs leading-tight font-mono break-all">
                  <span>ACK - {order.id}</span>
                  {ackInvoice.subtotal != null && <span> · Subtotal: {formatMoney(ackInvoice.subtotal)}</span>}
                </p>
                {ackInvoice.issuedAt && (
                  <p className="text-muted-foreground text-xs leading-tight mt-0.5">
                    Issued: {formatDate(ackInvoice.issuedAt)}{ackInvoice.issuedAt.includes('T') ? ' ' + new Date(ackInvoice.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Order details (left) | PAN, GST, Branch (right) */}
          <div className="flex flex-wrap gap-4 items-start rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium mb-1">Order details</p>
              <p>{customer.name ?? '—'}</p>
              <p className="text-muted-foreground">Phone: {customer.phone ?? '—'}</p>
              {order.orderType === 'SUBSCRIPTION' ? (
                <p className="text-muted-foreground">
                  Subscription booking{summary.subscription?.planName ? ` (${summary.subscription.planName})` : ''}
                </p>
              ) : order.orderSource !== 'WALK_IN' && (
                <p className="text-muted-foreground">
                  Service: {(order.serviceTypes && order.serviceTypes.length > 0 ? order.serviceTypes : [order.serviceType]).map((s) => s.replace(/_/g, ' ')).join(', ')}
                </p>
              )}
              {order.orderSource !== 'WALK_IN' && (
                <p>
                  {address.addressLine}, {address.pincode}
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline text-xs"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Map
                    </a>
                  ) : (
                    <span className="ml-1.5 text-xs text-muted-foreground">No Google Maps link saved</span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground">
                Pickup: {formatDate(order.pickupDate)} {order.timeWindow}
              </p>
            </div>
            <div className="text-right text-muted-foreground space-y-0.5">
              {summary.branch?.panNumber && <p>PAN: {summary.branch.panNumber}</p>}
              {summary.branch?.gstNumber && <p>GST: {summary.branch.gstNumber}</p>}
              {summary.branch && (
                <>
                  <p className="font-medium text-foreground">{summary.branch.name}</p>
                  <p>{summary.branch.address}</p>
                  {summary.branch.phone ? <p>Phone: {summary.branch.phone}</p> : null}
                </>
              )}
            </div>
          </div>

          {/* Subscription utilized (same line as on ACK – visible on Final invoice) + final weight input */}
          {summary.subscriptionUsage && summary.subscription && (
            <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-800 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-green-700 dark:text-green-300 font-medium" aria-hidden>✓</span>
                <span className="text-green-800 dark:text-green-200 font-medium">
                  {summary.subscription.planName}
                </span>
                <span className="text-green-800 dark:text-green-200">
                  {summary.subscription.remainingPickups}/{summary.subscription.maxPickups} pickups left
                  {summary.subscription.kgLimit != null && ` · ${effectiveUsedKg}/${summary.subscription.kgLimit} kg`}
                  {summary.subscription.itemsLimit != null && ` · ${effectiveUsedItems}/${summary.subscription.itemsLimit} items`}
                  {' · Applied'}
                </span>
                {finalInvoice?.status !== 'ISSUED' && summary.subscription.kgLimit != null && (
                  <span className="flex items-center gap-1.5 ml-auto ack-print-hide">
                    <label htmlFor="final-weight-kg" className="text-green-800 dark:text-green-200 whitespace-nowrap">Final weight (kg):</label>
                    <input
                      id="final-weight-kg"
                      type="number"
                      min={0}
                      step={0.1}
                      className="h-8 w-20 rounded border border-green-300 bg-white dark:bg-gray-900 px-2 text-sm"
                      value={finalWeightKg === '' ? '' : finalWeightKg}
                      onChange={(e) => setFinalWeightKg(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <span className="text-xs text-green-700 dark:text-green-300">Deducted from subscription</span>
                  </span>
                )}
                {finalInvoice?.status !== 'ISSUED' && summary.subscription.itemsLimit != null && summary.subscription.kgLimit == null && (
                  <span className="flex items-center gap-1.5 ml-auto ack-print-hide">
                    <label htmlFor="final-items-count" className="text-green-800 dark:text-green-200 whitespace-nowrap">Final items:</label>
                    <input
                      id="final-items-count"
                      type="number"
                      min={0}
                      step={1}
                      className="h-8 w-20 rounded border border-green-300 bg-white dark:bg-gray-900 px-2 text-sm"
                      value={finalItemsCount === '' ? '' : finalItemsCount}
                      onChange={(e) => setFinalItemsCount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                    />
                    <span className="text-xs text-green-700 dark:text-green-300">Deducted from subscription</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <InvoiceBuilder
            items={finalItems}
            taxPaise={0}
            discountPaise={0}
            onItemsChange={setFinalItems}
            onTaxChange={() => {}}
            onDiscountChange={() => {}}
            taxAsPercent={true}
            taxPercent={finalTaxPercent}
            onTaxPercentChange={setFinalTaxPercent}
            discountAsPercentOrAmount={true}
            discountType={finalDiscountType}
            discountValue={finalDiscountValue}
            onDiscountTypeChange={setFinalDiscountType}
            onDiscountValueChange={setFinalDiscountValue}
            comments={finalComments}
            onCommentsChange={setFinalComments}
            onSaveDraft={() =>
              createFinalDraft.mutate(toFinalDraftBody(finalItems, finalTaxPercent, finalDiscountType, finalDiscountValue, finalComments, finalWeightKg, finalItemsCount))
            }
            onIssue={() => issueFinal.mutate()}
            saveDraftLoading={createFinalDraft.isPending}
            issueLoading={issueFinal.isPending}
            draftExists={!!finalInvoice}
            issued={isFinalLocked || (finalInvoice?.status === 'ISSUED' && !editingFinal)}
            onPrint={() => {
              document.body.classList.add('print-final-invoice');
              window.print();
              document.body.classList.remove('print-final-invoice');
            }}
            showPrintOnly={true}
            pdfUrl={finalInvoice?.pdfUrl}
            whatsappShareMessage={finalInvoice?.pdfUrl ? `Final Invoice IN${order.id}: ${finalInvoice.pdfUrl.startsWith('http') ? finalInvoice.pdfUrl : `${getApiOrigin()}${finalInvoice.pdfUrl}`}` : undefined}
            printAreaRef={finalPrintAreaRef}
            catalog={catalog ?? undefined}
            catalogMatrix={catalogMatrix}
            orderMode="INDIVIDUAL"
            saveDraftLabel="Save Final Invoice"
            canSaveDraft={true}
            subscriptionUnit={hasSubscription && summary?.subscription ? (summary.subscription.kgLimit != null ? 'KG' : summary.subscription.itemsLimit != null ? 'Nos' : undefined) : undefined}
            subscriptionUsageRowIndex={undefined}
          />
          {(() => {
            const st = finalSubtotal(finalItems);
            const tax = Math.round(st * finalTaxPercent / 100);
            const disc = finalDiscountType === 'percent' ? Math.round(st * finalDiscountValue / 100) : finalDiscountValue;
            const finalTotal = st + tax - disc;
            return (
              <>
                <div className="mt-4 pt-4 border-t space-y-1 text-right">
                  <p className="text-base">
                    Subtotal: {formatMoney(st)} · Tax ({finalTaxPercent}%): {formatMoney(tax)} · Discount {finalDiscountType === 'percent' ? `(${finalDiscountValue}%)` : `(₹)`}: -{formatMoney(disc)}
                  </p>
                  <p className="text-2xl font-bold">Total: {formatMoney(finalTotal)}</p>
                </div>
                {branding?.termsAndConditions?.trim() && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Terms and Conditions</p>
                    <div className="whitespace-pre-line">{branding.termsAndConditions.trim()}</div>
                  </div>
                )}
                <div className="mt-6 pt-4 text-center text-sm text-muted-foreground space-y-1">
                  {summary.branch?.footerNote?.trim() ? <p>{summary.branch.footerNote.trim()}</p> : null}
                </div>
              </>
            );
          })()}
          {finalInvoice?.status === 'ISSUED' && editingFinal && (
            <Button size="sm" variant="outline" className="mt-2 ack-print-hide" onClick={() => setEditingFinal(false)}>
              Done editing
            </Button>
          )}
          {!canIssueFinalInvoice && (
            <p className="mt-2 text-xs text-muted-foreground">
              {order.orderSource === 'WALK_IN'
                ? 'Mark order as Ready (or later) to create/submit final invoice.'
                : 'Mark order as Out for Delivery or Delivered to create/submit final invoice.'}
            </p>
          )}
        </CardContent>
      </Card>
      </div>
      )}

      {showTabs && orderTab === 'payment' && finalSubmitted && (
      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
          {order.status === 'DELIVERED' && summary.payment?.status !== 'CAPTURED' && (
            <p className="text-sm text-muted-foreground">Record payment after delivery.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.payment ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={summary.payment.status} />
                <span className="font-medium">{formatMoney(summary.payment.amount)}</span>
                <span className="text-muted-foreground">{summary.payment.provider.replace(/_/g, ' ')}</span>
              </div>
              {summary.payment.note && (
                <p className="text-xs text-muted-foreground">
                  Note: {summary.payment.note}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No payment recorded.</p>
          )}

          {order.status === 'DELIVERED' && summary.payment?.status !== 'CAPTURED' && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Record payment</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentAmountRupees}
                    readOnly
                    className="h-9 w-28 rounded-md border px-2 text-sm bg-muted/40 text-muted-foreground cursor-not-allowed"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Method</label>
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value as typeof paymentProvider)}
                    className="h-9 min-w-[120px] rounded-md border px-2 text-sm"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                    <option value="RAZORPAY">Razorpay</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[160px] space-y-1">
                  <label className="text-xs text-muted-foreground block">Transaction details / note</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="h-9 w-full rounded-md border px-2 text-sm"
                    placeholder="UPI ref, last 4 digits, etc."
                  />
                </div>
                <Button
                  size="sm"
                  onClick={recordPayment}
                  disabled={updatePayment.isPending || paymentAmountRupees === '' || Number(paymentAmountRupees) <= 0}
                >
                  {updatePayment.isPending ? 'Recording…' : 'Record payment'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Final invoice total: {formatMoney(finalInvoice?.total ?? 0)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STATUS_FLOW.map((s) => {
            const idx = STATUS_FLOW.indexOf(currentStatusForFlow);
            const isNext =
              idx >= 0 && idx < STATUS_FLOW.length - 1 && STATUS_FLOW[idx + 1] === s;
            const isCurrent = currentStatusForFlow === s;
            const label = s === 'PICKED_UP' && isNext ? 'Confirm Pickup' : s.replace(/_/g, ' ');
            return (
              <Button
                key={s}
                size="sm"
                variant={isCurrent ? 'default' : 'outline'}
                disabled={updateStatus.isPending || (!isCurrent && !isNext)}
                onClick={() => updateStatus.mutate(s, { onSuccess: () => toast.success(`Status → ${s}`), onError: (e) => toast.error(e.message) })}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </footer>
    </>
  );
}
