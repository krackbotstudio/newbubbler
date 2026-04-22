'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrderSummary } from '@/hooks/useOrderSummary';
import { useUpdateOrderStatus } from '@/hooks/useOrderStatus';
import { useDeleteOrder } from '@/hooks/useOrders';
import { useCreateAckDraft, useIssueAck, useCreateFinalDraft, useIssueFinal } from '@/hooks/useInvoice';
import { useCatalogItemsWithPrices, useCatalogItemsWithMatrix } from '@/hooks/useCatalog';
import { useBranding } from '@/hooks/useBranding';
import { useUpdatePayment } from '@/hooks/usePayments';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  InvoiceStatusBadge,
  getOrderStatusLabel,
} from '@/components/shared/StatusBadge';
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
import { formatMoney, formatDate, formatPickupDayDisplay, formatTimeWindow24h, getGoogleMapsUrl } from '@/lib/format';
import { getApiOrigin, getFriendlyErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import type { OrderStatus, PaymentProvider } from '@/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { AcknowledgementInvoiceDialog } from '@/components/admin/orders/AcknowledgementInvoiceDialog';
import { FinalInvoiceDialog } from '@/components/admin/orders/FinalInvoiceDialog';
import { getStoredUser } from '@/lib/auth';
import { CUSTOMER_APP_URL } from '@/lib/customer-app-url';

function parseInvoiceItemClothesCount(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw as string | number);
  return Number.isFinite(n) && n >= 0.01 ? n : undefined;
}

const INVOICE_REMARKS_MAX = 500;

type InvoiceApiItem = {
  type: string;
  name: string;
  quantity: unknown;
  clothesCount?: unknown;
  remarks?: unknown;
  unitPrice: number;
  amount: number;
  catalogItemId?: string | null;
  segmentCategoryId?: string | null;
  serviceCategoryId?: string | null;
};

/** Maps API invoice lines to builder rows; legacy `clothesCount`-only rows become remarks text. */
function invoiceApiItemToLineRow(i: InvoiceApiItem): InvoiceLineRow {
  const remarksFromApi = typeof i.remarks === 'string' && i.remarks.trim() ? i.remarks.trim() : '';
  const clothesCount = parseInvoiceItemClothesCount(i.clothesCount);
  const legacyNumeric = clothesCount != null ? String(clothesCount) : '';
  const remarks = (remarksFromApi || legacyNumeric).slice(0, INVOICE_REMARKS_MAX);
  return {
    type: (i.type || 'SERVICE') as InvoiceLineRow['type'],
    name: i.name,
    quantity: Number(i.quantity),
    ...(remarks ? { remarks } : {}),
    unitPricePaise: i.unitPrice,
    amountPaise: i.amount,
    catalogItemId: i.catalogItemId ?? undefined,
    segmentCategoryId: i.segmentCategoryId ?? undefined,
    serviceCategoryId: i.serviceCategoryId ?? undefined,
  };
}

const STATUS_FLOW: OrderStatus[] = [
  'BOOKING_CONFIRMED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const orderId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';

  const { data: summary, isLoading, error } = useOrderSummary(orderId || null);
  const updateStatus = useUpdateOrderStatus(orderId);
  const deleteOrder = useDeleteOrder();
  const createAckDraft = useCreateAckDraft(orderId);
  const issueAck = useIssueAck(orderId);
  const createFinalDraft = useCreateFinalDraft(orderId);
  const issueFinal = useIssueFinal(orderId);
  const updatePayment = useUpdatePayment(orderId);
  const { data: catalog } = useCatalogItemsWithPrices();
  const { data: catalogMatrixData } = useCatalogItemsWithMatrix();
  const { data: branding } = useBranding();
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

  const [ackItems, setAckItems] = useState<InvoiceLineRow[]>([]);
  const [ackTaxPercent, setAckTaxPercent] = useState(0);
  const [ackDiscountType, setAckDiscountType] = useState<'percent' | 'amount'>('amount');
  const [ackDiscountValue, setAckDiscountValue] = useState(0);
  const [ackComments, setAckComments] = useState('Thank you');
  const hasPrefilledFinal = useRef(false);
  const hasHydratedAck = useRef(false);
  const hasHydratedFinal = useRef(false);
  const ackPrintAreaRef = useRef<HTMLDivElement>(null);
  const finalPrintAreaRef = useRef<HTMLDivElement>(null);
  const [finalItems, setFinalItems] = useState<InvoiceLineRow[]>([]);
  const [finalTaxPercent, setFinalTaxPercent] = useState(0);
  const [finalDiscountType, setFinalDiscountType] = useState<'percent' | 'amount'>('amount');
  const [finalDiscountValue, setFinalDiscountValue] = useState(0);
  const [finalComments, setFinalComments] = useState('Thank for opting our services');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('UPI');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [ackViewerOpen, setAckViewerOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [finalViewerOpen, setFinalViewerOpen] = useState(false);
  /** Set true in onAckIssueSuccess; cleared when summary shows ISSUED ACK — opens viewer after refetch. */
  const openAckViewerAfterIssueRef = useRef(false);
  const [ackPickupConfirmOpen, setAckPickupConfirmOpen] = useState(false);

  const buildFinalWhatsAppMessage = useCallback(() => {
    if (!summary?.order) return '';
    const o = summary.order;
    const cust = summary.customer;
    const fin = summary.invoices?.find((i) => i.type === 'FINAL');
    if (!fin) return '';
    const code = 'code' in fin && typeof fin.code === 'string' ? fin.code.trim() : '';
    const invoiceLabel = code || `IN${o.id}`;
    const customerName = cust?.name?.trim() || 'there';
    const statusLabel = getOrderStatusLabel(o.status);
    const parts: string[] = [
      `Hello ${customerName},`,
      '',
      'Thanks for opting our service.',
      '',
      `Order number: ${o.id}`,
      `Status: *${statusLabel}*`,
      '',
      `Final invoice: ${invoiceLabel}`,
      `Amount payable (final): *${formatMoney(fin.total)}*`,
      '',
      `Open our app: ${CUSTOMER_APP_URL}`,
    ];
    return parts.join('\n');
  }, [summary]);

  useEffect(() => {
    if (!summary) return;
    const inv = Array.isArray(summary.invoices) ? summary.invoices : [];
    const ack = inv.find((i) => i.type === 'ACKNOWLEDGEMENT');
    if (ack?.status === 'ISSUED' && openAckViewerAfterIssueRef.current) {
      openAckViewerAfterIssueRef.current = false;
      setAckViewerOpen(true);
    }
  }, [summary]);

  // Hydrate ACK form from saved invoice when summary loads
  useEffect(() => {
    if (!summary) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const ack = invList.find((i) => i.type === 'ACKNOWLEDGEMENT');
    if (ack) {
      if (!hasHydratedAck.current) {
        hasHydratedAck.current = true;
        if (ack.items?.length) {
          setAckItems(ack.items.map((i) => invoiceApiItemToLineRow(i as InvoiceApiItem)));
        }
        if (ack.subtotal != null && ack.tax != null) {
          const discPaise = ack.discountPaise ?? 0;
          const taxable = Math.max(0, ack.subtotal - discPaise);
          setAckTaxPercent(taxable > 0 ? Math.round((ack.tax / taxable) * 1000) / 10 : 0);
        }
        setAckDiscountType('amount');
        setAckDiscountValue(ack.discountPaise ?? 0);
        setAckComments(ack.comments ?? 'Thank you');
      }
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
      setFinalItems(finalInv.items.map((i) => invoiceApiItemToLineRow(i as InvoiceApiItem)));
      if (finalInv.subtotal != null && finalInv.tax != null) {
        const discPaise = finalInv.discountPaise ?? 0;
        const taxable = Math.max(0, finalInv.subtotal - discPaise);
        setFinalTaxPercent(taxable > 0 ? Math.round((finalInv.tax / taxable) * 1000) / 10 : 0);
      }
      setFinalDiscountType('amount');
      setFinalDiscountValue(finalInv.discountPaise ?? 0);
      setFinalComments(finalInv.comments ?? '');
    } else if (ack) {
      hasPrefilledFinal.current = true;
      const ackItems = ack?.items;
      if (ackItems?.length) {
        setFinalItems(ackItems.map((i) => invoiceApiItemToLineRow(i as InvoiceApiItem)));
      }
      if (ack.subtotal != null && ack.tax != null) {
        const discPaise = ack.discountPaise ?? 0;
        const taxable = Math.max(0, ack.subtotal - discPaise);
        setFinalTaxPercent(taxable > 0 ? Math.round((ack.tax / taxable) * 1000) / 10 : 0);
      }
      setFinalDiscountType(ackDiscountType);
      setFinalDiscountValue(
        ackDiscountType === 'percent' && (ack.subtotal ?? 0) > 0 && (ack.discountPaise ?? 0) > 0
          ? Math.round(((ack.discountPaise ?? 0) / ack.subtotal!) * 100)
          : (ack.discountPaise ?? 0)
      );
      setFinalComments(ack.comments ?? '');
    }
  }, [summary, ackDiscountType]);

  // After ACK is submitted (ISSUED), sync Final invoice form from ACK so "same is added to Final Invoices"
  useEffect(() => {
    if (!summary) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const ack = invList.find((i) => i.type === 'ACKNOWLEDGEMENT');
    const finalInv = invList.find((i) => i.type === 'FINAL');
    if (ack?.status !== 'ISSUED' || finalInv?.items?.length) return;

    if (ack.items?.length) {
      setFinalItems(ack.items.map((i) => invoiceApiItemToLineRow(i as InvoiceApiItem)));
    }

    if (ack.subtotal != null && ack.tax != null) {
      const discPaise = ack.discountPaise ?? 0;
      const taxable = Math.max(0, ack.subtotal - discPaise);
      setFinalTaxPercent(taxable > 0 ? Math.round((ack.tax / taxable) * 1000) / 10 : 0);
    }
    setFinalDiscountType(ackDiscountType);
    setFinalDiscountValue(
      ackDiscountType === 'percent' && (ack.subtotal ?? 0) > 0 && (ack.discountPaise ?? 0) > 0
        ? Math.round(((ack.discountPaise ?? 0) / ack.subtotal!) * 100)
        : (ack.discountPaise ?? 0)
    );
    setFinalComments(ack.comments ?? '');
  }, [summary, ackDiscountType]);

  // Prefill payment amount from issued final invoice total (for record-payment dialog)
  useEffect(() => {
    if (!summary) return;
    const invList = Array.isArray(summary.invoices) ? summary.invoices : [];
    const fin = invList.find((i) => i.type === 'FINAL');
    if (fin?.status !== 'ISSUED' || fin.total == null || fin.total <= 0) return;
    if (paymentAmountRupees === '') {
      setPaymentAmountRupees(fin.total / 100);
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
  const branchLogoPath = summary.branch?.logoUrl?.trim();
  const orgLogoPath = branding?.logoUrl?.trim();
  const invoiceHeaderLogoPath = branchLogoPath || orgLogoPath;
  const invoiceHeaderLogoCacheKey = branchLogoPath
    ? (summary.branch?.updatedAt ?? '')
    : (branding?.updatedAt ?? '');
  /** Same rules as API assertCanIssueFinalInvoice (issue + save final draft). */
  const canIssueFinalInvoice =
    order.status === 'OUT_FOR_DELIVERY' ||
    order.status === 'DELIVERED' ||
    (order.orderSource === 'WALK_IN' && order.status === 'READY');
  const ackSubmitted = ackInvoice?.status === 'ISSUED';
  const finalSubmitted = finalInvoice?.status === 'ISSUED';
  const paymentRecorded = summary.payment?.status === 'CAPTURED';
  /** Show final invoice UI (read-only until status allows issue: OFD / Delivered / walk-in Ready). */
  const canEditFinalInvoiceForm =
    order.status !== 'CANCELLED' &&
    ackSubmitted &&
    !finalSubmitted &&
    !paymentRecorded;
  /** Inline “Out for delivery” before totals; walk-in at Ready issues final without this step. */
  const canMarkOutForDelivery =
    ackSubmitted &&
    !finalSubmitted &&
    order.status !== 'CANCELLED' &&
    ['PICKED_UP', 'IN_PROCESSING', 'READY'].includes(order.status) &&
    !(order.orderSource === 'WALK_IN' && order.status === 'READY');
  const showTabs = ackSubmitted;
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isLocked = ackInvoice?.status === 'ISSUED';
  const isFinalLocked = paymentRecorded;

  const ackSubtotal = (items: InvoiceLineRow[]) =>
    items.reduce((s, i) => s + (i.amountPaise ?? i.quantity * i.unitPricePaise), 0);
  const toAckDraftBody = (
    items: InvoiceLineRow[],
    taxPercent: number,
    discountType: 'percent' | 'amount',
    discountValue: number,
    comments: string,
  ) => {
    const itemsSubtotal = ackSubtotal(items);
    const discountPaise =
      discountType === 'percent'
        ? Math.round(itemsSubtotal * discountValue / 100)
        : discountValue;
    const taxableAfterDiscount = Math.max(0, itemsSubtotal - discountPaise);
    const taxPaise = Math.round(taxableAfterDiscount * taxPercent / 100);
    const commentsWithBillNote = (comments?.trim() || 'Thank you') || undefined;
    return {
      orderMode: 'INDIVIDUAL' as const,
      items: items.map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        amountPaise: Math.round(i.amountPaise ?? i.quantity * i.unitPricePaise),
        catalogItemId: i.catalogItemId,
        segmentCategoryId: i.segmentCategoryId,
        serviceCategoryId: i.serviceCategoryId,
        ...(i.remarks != null &&
          String(i.remarks).trim() !== '' && {
            remarks: String(i.remarks).trim().slice(0, INVOICE_REMARKS_MAX),
          }),
      })),
      taxPaise,
      discountPaise,
      comments: commentsWithBillNote,
    };
  };
  const finalSubtotal = (items: InvoiceLineRow[]) =>
    items.reduce((s, i) => s + (i.amountPaise ?? i.quantity * i.unitPricePaise), 0);
  const toFinalDraftBody = (
    items: InvoiceLineRow[],
    taxPercent: number,
    discountType: 'percent' | 'amount',
    discountValue: number,
    comments: string,
  ) => {
    const subtotal = finalSubtotal(items);
    const discountPaise = discountType === 'percent' ? Math.round(subtotal * discountValue / 100) : discountValue;
    const taxableAfterDiscount = Math.max(0, subtotal - discountPaise);
    const taxPaise = Math.round(taxableAfterDiscount * taxPercent / 100);
    return {
      orderMode: 'INDIVIDUAL' as const,
      items: items.map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        amountPaise: Math.round(i.amountPaise ?? i.quantity * i.unitPricePaise),
        catalogItemId: i.catalogItemId,
        segmentCategoryId: i.segmentCategoryId,
        serviceCategoryId: i.serviceCategoryId,
        ...(i.remarks != null &&
          String(i.remarks).trim() !== '' && {
            remarks: String(i.remarks).trim().slice(0, INVOICE_REMARKS_MAX),
          }),
      })),
      taxPaise,
      discountPaise,
      comments: comments || undefined,
    };
  };

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
    const amountPaise =
      finalInvoice?.total != null && finalInvoice.total > 0
        ? finalInvoice.total
        : paymentAmountRupees === ''
          ? 0
          : Math.round(Number(paymentAmountRupees) * 100);
    if (amountPaise <= 0) {
      toast.error('Final invoice amount is missing or zero.');
      return;
    }
    const provider: PaymentProvider = paymentProvider === 'CASH' ? 'CASH' : 'UPI';
    updatePayment.mutate(
      { provider, status: 'CAPTURED', amountPaise, note: paymentNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Payment recorded. Order marked as delivered.');
          setPaymentDialogOpen(false);
          setPaymentNote('');
        },
        onError: (e) => toast.error(getFriendlyErrorMessage(e)),
      },
    );
  };

  const onAckIssueSuccess = () => {
    openAckViewerAfterIssueRef.current = true;
    if (order.status === 'BOOKING_CONFIRMED' || order.status === 'PICKUP_SCHEDULED') {
      updateStatus.mutate('PICKED_UP', {
        onSuccess: () => toast.success('ACK submitted; status set to Picked up'),
        onError: (e) => toast.error(e.message),
      });
    } else {
      toast.success('ACK invoice submitted');
    }
  };

  const submitAckInvoiceFromConfirmDialog = () => {
    const onIssueError = (e: Error) => toast.error(getFriendlyErrorMessage(e));
    const close = () => setAckPickupConfirmOpen(false);
    if (!ackInvoice) {
      createAckDraft.mutate(
        toAckDraftBody(ackItems, ackTaxPercent, ackDiscountType, ackDiscountValue, ackComments),
        {
          onSuccess: () => {
            issueAck.mutate(undefined, {
              onSuccess: () => {
                onAckIssueSuccess();
                close();
              },
              onError: onIssueError,
            });
          },
          onError: (e) => toast.error(getFriendlyErrorMessage(e)),
        },
      );
    } else {
      issueAck.mutate(undefined, {
        onSuccess: () => {
          onAckIssueSuccess();
          close();
        },
        onError: onIssueError,
      });
    }
  };

  /** Submit: persist draft then issue (one click). Issued finals are read-only (no UI edit). */
  const submitFinalInvoice = () => {
    const body =
      finalItems.length > 0
        ? toFinalDraftBody(finalItems, finalTaxPercent, finalDiscountType, finalDiscountValue, finalComments)
        : toFinalDraftBody([], finalTaxPercent, finalDiscountType, finalDiscountValue, finalComments);

    createFinalDraft.mutate(body, {
      onSuccess: () => {
        issueFinal.mutate(undefined, {
          onSuccess: () => toast.success('Final invoice submitted'),
          onError: (e) => toast.error(getFriendlyErrorMessage(e)),
        });
      },
      onError: (e) => toast.error(getFriendlyErrorMessage(e)),
    });
  };

  type TimelineStage = { key: string; label: string; ts: string | null };
  const paymentTimelineLabel =
    paymentRecorded && summary.payment
      ? 'Payment done'
      : finalSubmitted
        ? 'Payment due'
        : 'Payment';
  const paymentTimelineTs =
    paymentRecorded && summary.payment
      ? (summary.payment.createdAt ?? order.updatedAt ?? null)
      : finalSubmitted
        ? (finalInvoice?.issuedAt ?? null)
        : null;
  const timelineStages: TimelineStage[] =
    order.status === 'CANCELLED'
      ? [
          { key: 'BOOKING_CONFIRMED', label: 'Order initiated', ts: order.createdAt ?? null },
          { key: 'PICKED_UP', label: 'Picked up', ts: order.pickedUpAt ?? null },
          {
            key: 'CANCELLED',
            label: 'Cancelled',
            ts: order.cancelledAt ?? order.updatedAt ?? null,
          },
        ]
      : [
          { key: 'BOOKING_CONFIRMED', label: 'Order initiated', ts: order.createdAt ?? null },
          { key: 'PICKED_UP', label: 'Picked up', ts: order.pickedUpAt ?? null },
          { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', ts: order.outForDeliveryAt ?? null },
          { key: 'DELIVERED', label: 'Delivered', ts: order.deliveredAt ?? null },
          { key: 'PAYMENT', label: paymentTimelineLabel, ts: paymentTimelineTs },
        ];
  const currentStatusForFlow: OrderStatus =
    order.status === 'PICKUP_SCHEDULED'
      ? 'BOOKING_CONFIRMED'
      : (order.status === 'IN_PROCESSING' || order.status === 'READY')
        ? 'PICKED_UP'
        : order.status;
  const currentIdx = STATUS_FLOW.indexOf(currentStatusForFlow);
  const formatTs = (s: string | null) => (s ? formatDate(s) + (s.includes('T') ? ' ' + new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '') : '—');

  const orderServiceTypesLabel =
    (order.serviceTypes && order.serviceTypes.length > 0 ? order.serviceTypes : [order.serviceType])
      .filter(Boolean)
      .map((s) => String(s).replace(/_/g, ' '))
      .join(', ') || null;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print{body *{visibility:hidden!important}.ack-invoice-print-area,.ack-invoice-print-area *,.final-invoice-print-area,.final-invoice-print-area *{visibility:visible!important}.ack-invoice-print-area,.final-invoice-print-area{position:absolute;left:0;top:0;width:100%;padding:0!important;margin:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.ack-invoice-print-area{background:#f3f4f6!important}.final-invoice-print-area{background:#fdf2f8!important}.ack-invoice-print-area input,.ack-invoice-print-area select,.ack-invoice-print-area textarea,.final-invoice-print-area input,.final-invoice-print-area select,.final-invoice-print-area textarea{border:none!important;background:transparent!important;box-shadow:none!important;appearance:none}.ack-invoice-print-area button,.ack-invoice-print-area .ack-print-hide,.ack-invoice-print-area .ack-print-hide-header,.final-invoice-print-area button,.final-invoice-print-area .ack-print-hide,.final-invoice-print-area .ack-print-hide-header{display:none!important}.ack-invoice-print-area > div,.final-invoice-print-area > div{padding-top:0.5rem!important;margin-top:0!important}.ack-invoice-print-area .ack-print-hide-header + div,.final-invoice-print-area .ack-print-hide-header + div{padding-top:0.5rem!important}main{overflow:visible!important}header,footer,aside,nav,.fixed{visibility:hidden!important;display:none!important}}`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `.ack-invoice-print-area.pdf-capture button,.ack-invoice-print-area.pdf-capture .ack-print-hide,.ack-invoice-print-area.pdf-capture .ack-print-hide-header,.final-invoice-print-area.pdf-capture button,.final-invoice-print-area.pdf-capture .ack-print-hide,.final-invoice-print-area.pdf-capture .ack-print-hide-header,.invoice-print-view.pdf-capture button,.invoice-print-view.pdf-capture .ack-print-hide,.invoice-print-view.pdf-capture .ack-print-hide-header{display:none!important}`,
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
          <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Individual booking
          </span>
          {orderServiceTypesLabel ? (
            <span
              className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
              title="Service types"
            >
              {orderServiceTypesLabel}
            </span>
          ) : null}
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 shadow-sm',
          'dark:border-primary/35 dark:bg-primary/15',
        )}
        role="status"
        aria-label="Scheduled pickup"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Pickup</span>
        {order.orderSource === 'WALK_IN' ? (
          <span className="text-base font-semibold text-foreground">Walk order</span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-base font-semibold text-foreground">
            <span className="tabular-nums">{formatPickupDayDisplay(order.pickupDate)}</span>
            <span className="font-normal text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="font-mono tabular-nums tracking-tight">
              {formatTimeWindow24h(order.timeWindow) || order.timeWindow.trim() || '—'}
            </span>
          </span>
        )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Status</CardTitle>
              <CardDescription>Horizontal timeline with timestamps</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {ackInvoice?.status === 'ISSUED' && (
                  <Button variant="secondary" size="sm" onClick={() => setAckViewerOpen(true)}>
                    Acknowledgement invoice
                  </Button>
                )}
                {finalInvoice?.status === 'ISSUED' && (
                  <Button variant="secondary" size="sm" onClick={() => setFinalViewerOpen(true)}>
                    Final invoice
                  </Button>
                )}
                {finalSubmitted && !paymentRecorded && (finalInvoice?.total ?? 0) > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setPaymentProvider('UPI');
                      setPaymentDialogOpen(true);
                    }}
                  >
                    Record payment
                  </Button>
                )}
                {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && ackInvoice?.status !== 'ISSUED' && (
                  <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
                    Cancel order
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteOrder.isPending}
                  >
                    Delete order
                  </Button>
                )}
              </div>
              {finalSubmitted && (
                <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-right min-w-[260px]">
                  {paymentRecorded && summary.payment ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-end gap-2">
                        <PaymentStatusBadge status={summary.payment.status} />
                        <span className="font-medium tabular-nums">{formatMoney(summary.payment.amount)}</span>
                        <span className="text-muted-foreground">{summary.payment.provider.replace(/_/g, ' ')}</span>
                      </div>
                      {summary.payment.note ? (
                        <p className="text-muted-foreground truncate max-w-[360px]" title={summary.payment.note}>
                          <span className="font-medium text-foreground">Comments: </span>
                          {summary.payment.note}
                        </p>
                      ) : null}
                    </div>
                  ) : (finalInvoice?.total ?? 0) <= 0 ? (
                    <p className="text-muted-foreground">No payment due (₹0 final invoice).</p>
                  ) : (
                    <p className="text-muted-foreground">Awaiting payment.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-start">
              {timelineStages.map((stage, idx) => {
                const isCancelledOrder = order.status === 'CANCELLED';
                const isCancelledStage = stage.key === 'CANCELLED';
                let isReached: boolean;
                let isCurrent: boolean;
                /** Line segment after this stage (same semantics as before for active orders). */
                let connectorStrong: boolean;
                if (isCancelledOrder) {
                  if (isCancelledStage) {
                    isCurrent = true;
                    isReached = true;
                    connectorStrong = true;
                  } else if (stage.key === 'BOOKING_CONFIRMED') {
                    isCurrent = false;
                    isReached = true;
                    connectorStrong = true;
                  } else if (stage.key === 'PICKED_UP') {
                    isCurrent = false;
                    isReached = !!stage.ts;
                    connectorStrong = true;
                  } else {
                    isCurrent = false;
                    isReached = false;
                    connectorStrong = false;
                  }
                } else if (stage.key === 'PAYMENT') {
                  const deliveredReached = currentIdx >= STATUS_FLOW.indexOf('DELIVERED');
                  isReached = paymentRecorded || finalSubmitted;
                  isCurrent = paymentRecorded || (deliveredReached && !paymentRecorded);
                  connectorStrong = deliveredReached;
                } else {
                  const flowIdx = STATUS_FLOW.indexOf(stage.key as OrderStatus);
                  isReached = currentIdx >= flowIdx;
                  isCurrent = order.status === stage.key;
                  connectorStrong = isReached;
                }
                return (
                  <div key={stage.key} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center" style={{ minWidth: '90px' }}>
                      <div
                        className={cn(
                          'rounded px-2 py-1 text-center text-xs font-medium',
                          isCancelledStage && isCurrent
                            ? 'bg-destructive text-white'
                            : isCurrent
                              ? 'bg-primary text-primary-foreground'
                              : isReached
                                ? 'bg-muted'
                                : 'bg-muted/50 text-muted-foreground',
                        )}
                      >
                        {stage.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatTs(stage.ts)}</p>
                    </div>
                    {idx < timelineStages.length - 1 && (
                      <div
                        className={cn('w-6 h-0.5 flex-shrink-0', connectorStrong ? 'bg-muted' : 'bg-muted/50')}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent showClose={true} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Confirm the amount from the final invoice and how the customer paid. Add transaction details in comments if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount (final invoice)</label>
              <div className="h-10 w-full rounded-md border bg-muted/50 px-3 flex items-center text-sm font-medium tabular-nums">
                {formatMoney(finalInvoice?.total ?? 0)}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="pay-method">
                Type of payment
              </label>
              <select
                id="pay-method"
                value={paymentProvider === 'CASH' ? 'CASH' : 'UPI'}
                onChange={(e) => setPaymentProvider(e.target.value as PaymentProvider)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="pay-comments">
                Comments (transaction details)
              </label>
              <textarea
                id="pay-comments"
                className="min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder="UPI ref, transaction ID, receipt notes, etc."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={recordPayment}
              disabled={
                updatePayment.isPending || !finalInvoice?.total || finalInvoice.total <= 0
              }
            >
              {updatePayment.isPending ? 'Confirming…' : 'Confirm payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Delete order permanently</DialogTitle>
            <DialogDescription>
              This action is irreversible. The order and all related records (invoices, payments, usage links) will be deleted permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Warning: Once deleted, this order cannot be recovered.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => {
                deleteOrder.mutate(order.id, {
                  onSuccess: () => {
                    toast.success('Order deleted permanently');
                    setDeleteDialogOpen(false);
                    router.push('/orders');
                  },
                  onError: (e) => toast.error(getFriendlyErrorMessage(e)),
                });
              }}
            >
              {deleteOrder.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              Cancel this order before issuing the ACK invoice. Please provide a reason.
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

      <Dialog open={ackPickupConfirmOpen} onOpenChange={setAckPickupConfirmOpen}>
        <DialogContent showClose className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Confirm pick up</DialogTitle>
            <DialogDescription>
              Review the acknowledgement invoice lines and total. Submit issues the invoice and updates order status to picked up when the order is in booking or pickup-scheduled state.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 py-2">
            {ackItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one line item on the invoice before submitting.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3">Item</th>
                        <th className="whitespace-nowrap py-2 pl-3 pr-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Qty
                        </th>
                        <th className="whitespace-nowrap border-l border-border/70 py-2 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Remarks
                        </th>
                        <th className="text-right py-2 px-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ackItems.map((row, idx) => {
                        const lineAmount = row.amountPaise ?? row.quantity * row.unitPricePaise;
                        const seg =
                          catalogMatrix && row.segmentCategoryId
                            ? catalogMatrix.segmentCategories.find((s) => s.id === row.segmentCategoryId)?.label
                            : null;
                        const svc =
                          catalogMatrix && row.serviceCategoryId
                            ? catalogMatrix.serviceCategories.find((s) => s.id === row.serviceCategoryId)?.label
                            : null;
                        const detail = [seg, svc].filter(Boolean).join(' · ');
                        return (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2 px-3">
                              <div className="font-medium">{row.name}</div>
                              {detail ? (
                                <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
                              ) : null}
                            </td>
                            <td className="py-2 pl-3 pr-10 text-right text-sm font-medium tabular-nums text-foreground">
                              {row.quantity}
                            </td>
                            <td className="max-w-[16rem] whitespace-normal break-words border-l border-border/70 py-2 pl-5 pr-3 text-left text-sm font-medium leading-snug text-foreground">
                              {(row.remarks ?? '').trim() || '—'}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">{formatMoney(lineAmount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const st = ackSubtotal(ackItems);
                  const disc =
                    ackDiscountType === 'percent'
                      ? Math.round((st * ackDiscountValue) / 100)
                      : ackDiscountValue;
                  const taxableAfterDisc = Math.max(0, st - disc);
                  const tax = Math.round((taxableAfterDisc * ackTaxPercent) / 100);
                  const total = st - disc + tax;
                  return (
                    <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="tabular-nums font-medium">{formatMoney(st)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Discount{' '}
                          {ackDiscountType === 'percent' ? `(${ackDiscountValue}%)` : '(₹)'}
                        </span>
                        <span className="tabular-nums font-medium">−{formatMoney(disc)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Tax ({ackTaxPercent}%)</span>
                        <span className="tabular-nums font-medium">{formatMoney(tax)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-t pt-2 mt-2 text-base font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">{formatMoney(total)}</span>
                      </div>
                    </div>
                  );
                })()}
                {ackComments.trim() ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Comments (on invoice)</p>
                    <p className="text-sm whitespace-pre-line rounded-md border bg-background px-3 py-2">
                      {ackComments.trim()}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => setAckPickupConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitAckInvoiceFromConfirmDialog}
              disabled={
                ackItems.length === 0 ||
                createAckDraft.isPending ||
                issueAck.isPending ||
                finalSubmitted
              }
              style={
                summary.branch?.primaryColor
                  ? {
                      backgroundColor: summary.branch.primaryColor,
                      borderColor: summary.branch.primaryColor,
                      color: '#fff',
                    }
                  : undefined
              }
              className={summary.branch?.primaryColor ? 'hover:opacity-90 border-0' : undefined}
            >
              {createAckDraft.isPending || issueAck.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {summary && ackInvoice?.status === 'ISSUED' && (
        <AcknowledgementInvoiceDialog
          open={ackViewerOpen}
          onOpenChange={setAckViewerOpen}
          summary={summary}
          ackInvoice={ackInvoice}
          branding={branding ?? null}
          catalogMatrix={catalogMatrix}
          orderId={order.id}
        />
      )}

      {summary && finalInvoice?.status === 'ISSUED' && (
        <FinalInvoiceDialog
          open={finalViewerOpen}
          onOpenChange={setFinalViewerOpen}
          summary={summary}
          finalInvoice={finalInvoice}
          ackInvoice={ackInvoice}
          branding={branding ?? null}
          catalogMatrix={catalogMatrix}
          orderId={order.id}
        />
      )}

      {!ackSubmitted && (
      <div ref={ackPrintAreaRef} className="ack-invoice-print-area rounded-lg p-4 bg-gray-100">
      {finalSubmitted && (
        <p className="text-sm text-muted-foreground mb-3 ack-print-hide">Acknowledgement invoice cannot be edited after Final invoice is submitted.</p>
      )}
      <Card className="bg-transparent border-0 shadow-none">
        <CardContent className="mx-auto w-full max-w-6xl space-y-4 pt-6">
          {/* Header: centered logo only */}
          <div className="flex border-b pb-4 items-center justify-center">
            <div className="flex-shrink-0 flex justify-center">
              {invoiceHeaderLogoPath ? (
                <img
                  src={`${invoiceHeaderLogoPath.startsWith('http') ? invoiceHeaderLogoPath : `${getApiOrigin()}${invoiceHeaderLogoPath}`}${(invoiceHeaderLogoPath.startsWith('http') ? invoiceHeaderLogoPath : `${getApiOrigin()}${invoiceHeaderLogoPath}`).includes('?') ? '&' : '?'}v=${encodeURIComponent(invoiceHeaderLogoCacheKey)}`}
                  alt="Logo"
                  className="invoice-header-logo-img h-28 w-auto max-w-[340px] object-contain"
                />
              ) : (
                <div className="invoice-header-logo-img flex h-28 w-36 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  Logo
                </div>
              )}
            </div>
          </div>

          {/* Same line: Order details (left) | ACK number, PAN, GST, Branch & address (right) */}
          <div className="flex flex-wrap gap-4 items-start rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex-1 min-w-[200px]">
              <p className="font-bold mb-1">Order details</p>
              <p>{customer.name ?? '—'}</p>
              <p className="text-muted-foreground">Phone: {customer.phone ?? '—'}</p>
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
              {ackInvoice && (
                <p className="text-xs text-muted-foreground mt-1">Acknowledgement Invoice ACK - {order.id}</p>
              )}
            </div>
            <div className="text-right text-muted-foreground space-y-0.5">
              <p className="font-bold text-foreground mb-1">
                {summary.branch?.name?.trim() || branding?.businessName?.trim() || '—'}
              </p>
              {summary.branch?.panNumber && <p>PAN: {summary.branch.panNumber}</p>}
              {summary.branch?.gstNumber && <p>GST: {summary.branch.gstNumber}</p>}
              {summary.branch && (
                <>
                  {summary.branch.address?.trim() &&
                  summary.branch.address.trim().toLowerCase() !== summary.branch.name.trim().toLowerCase() ? (
                    <p>{summary.branch.address}</p>
                  ) : null}
                  {summary.branch.phone ? <p>Phone: {summary.branch.phone}</p> : null}
                </>
              )}
            </div>
          </div>

          <InvoiceBuilder
            items={ackItems}
            taxPaise={0}
            discountPaise={0}
            branchPrimaryColor={summary.branch?.primaryColor ?? null}
            branchSecondaryColor={summary.branch?.secondaryColor ?? null}
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
            comments={ackComments}
            onCommentsChange={setAckComments}
            onSaveDraft={() => {}}
            onIssue={() => {}}
            saveDraftLoading={false}
            issueLoading={issueAck.isPending || createAckDraft.isPending}
            draftExists={!!ackInvoice}
            issued={isLocked || finalSubmitted}
            disableEditing={order.status === 'CANCELLED'}
            issueDisabled={finalSubmitted}
            onPrint={() => window.print()}
            showPrintOnly={true}
            pdfUrl={ackInvoice?.pdfUrl}
            whatsappShareMessage={ackInvoice?.pdfUrl ? `Acknowledgement Invoice ACK - ${order.id}: ${ackInvoice.pdfUrl.startsWith('http') ? ackInvoice.pdfUrl : `${getApiOrigin()}${ackInvoice.pdfUrl}`}` : undefined}
            printAreaRef={ackPrintAreaRef}
            catalog={catalog ?? undefined}
            catalogMatrix={catalogMatrix}
            tagPrintOrderLabel={order.id}
            tagBrandName={
              summary.branch?.itemTagBrandName?.trim() ||
              summary.branch?.name?.trim() ||
              branding?.businessName?.trim() ||
              undefined
            }
            tagLabelPickupDate={order.pickupDate}
            tagLabelWalkIn={order.orderSource === 'WALK_IN'}
            pickupConfirmFlow
            onConfirmPickupClick={() => setAckPickupConfirmOpen(true)}
            pickupConfirmDisabled={ackItems.length === 0 || finalSubmitted}
          />
          {(() => {
            const itemsSt = ackSubtotal(ackItems);
            const st = itemsSt;
            const disc = ackDiscountType === 'percent' ? Math.round(st * ackDiscountValue / 100) : ackDiscountValue;
            const taxableAfterDisc = Math.max(0, st - disc);
            const tax = Math.round(taxableAfterDisc * ackTaxPercent / 100);
            const ackTotal = st - disc + tax;
            return (
              <>
                <div className="mt-4 pt-4 border-t space-y-1 text-right">
                  <p className="text-base">
                    Subtotal: {formatMoney(st)} · Discount {ackDiscountType === 'percent' ? `(${ackDiscountValue}%)` : `(₹)`}: -{formatMoney(disc)} · Tax ({ackTaxPercent}%): {formatMoney(tax)}
                  </p>
                  <p className="text-2xl font-bold">
                    {`Total: ${formatMoney(ackTotal)}`}
                  </p>
                </div>
                {branding?.termsAndConditions?.trim() && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Terms and Conditions</p>
                    <div className="whitespace-pre-line">{branding.termsAndConditions.trim()}</div>
                  </div>
                )}
                <div className="mt-6 pt-4 text-center text-sm text-muted-foreground space-y-1">
                  {summary.branch?.footerNote?.trim() ? (
                    <p className="whitespace-pre-line">{summary.branch.footerNote.trim()}</p>
                  ) : (
                    <p>
                      {[
                        summary.branch?.address ?? '',
                        branding?.email ?? '',
                        summary.branch?.phone ?? branding?.phone ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
      </div>
      )}

      {showTabs && (
      <div className="final-invoice-print-area rounded-lg p-4 bg-secondary/30">
      <Card className="bg-transparent border-0 shadow-none">
        {isFinalLocked && (
          <CardHeader className="ack-print-hide-header">
            <p className="text-sm text-muted-foreground ack-print-hide">Final invoice cannot be edited after payment is collected.</p>
          </CardHeader>
        )}
        <div
          ref={finalPrintAreaRef}
          className="mx-auto w-full max-w-6xl rounded-lg bg-white p-6 shadow-sm invoice-print-view space-y-4 [color-scheme:light]"
        >
        <CardContent className="space-y-4 p-0">
          {/* Header: centered logo only */}
          <div className="flex border-b pb-4 items-center justify-center">
            <div className="flex-shrink-0 flex justify-center">
              {invoiceHeaderLogoPath ? (
                <img
                  src={`${invoiceHeaderLogoPath.startsWith('http') ? invoiceHeaderLogoPath : `${getApiOrigin()}${invoiceHeaderLogoPath}`}${(invoiceHeaderLogoPath.startsWith('http') ? invoiceHeaderLogoPath : `${getApiOrigin()}${invoiceHeaderLogoPath}`).includes('?') ? '&' : '?'}v=${encodeURIComponent(invoiceHeaderLogoCacheKey)}`}
                  alt="Logo"
                  className="invoice-header-logo-img h-28 w-auto max-w-[340px] object-contain"
                />
              ) : (
                <div className="invoice-header-logo-img flex h-28 w-36 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  Logo
                </div>
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
              <p className="font-bold mb-1">Order details</p>
              <p>{customer.name ?? '—'}</p>
              <p className="text-muted-foreground">Phone: {customer.phone ?? '—'}</p>
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
            </div>
            <div className="text-right text-muted-foreground space-y-0.5">
              <p className="font-bold text-foreground mb-1">
                {summary.branch?.name?.trim() || branding?.businessName?.trim() || '—'}
              </p>
              {summary.branch?.panNumber && <p>PAN: {summary.branch.panNumber}</p>}
              {summary.branch?.gstNumber && <p>GST: {summary.branch.gstNumber}</p>}
              {summary.branch && (
                <>
                  {summary.branch.address?.trim() &&
                  summary.branch.address.trim().toLowerCase() !== summary.branch.name.trim().toLowerCase() ? (
                    <p>{summary.branch.address}</p>
                  ) : null}
                  {summary.branch.phone ? <p>Phone: {summary.branch.phone}</p> : null}
                </>
              )}
            </div>
          </div>

          <InvoiceBuilder
            items={finalItems}
            taxPaise={0}
            discountPaise={0}
            branchPrimaryColor={summary.branch?.primaryColor ?? null}
            branchSecondaryColor={summary.branch?.secondaryColor ?? null}
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
            afterCommentsSlot={
              canMarkOutForDelivery ? (
                <Button
                  type="button"
                  disabled={updateStatus.isPending}
                  style={
                    summary.branch?.primaryColor
                      ? {
                          backgroundColor: summary.branch.primaryColor,
                          borderColor: summary.branch.primaryColor,
                          color: '#fff',
                        }
                      : undefined
                  }
                  className={cn(summary.branch?.primaryColor && 'hover:opacity-90 border-0')}
                  onClick={() =>
                    updateStatus.mutate('OUT_FOR_DELIVERY', {
                      onSuccess: () => toast.success('Order marked out for delivery'),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  {updateStatus.isPending ? 'Updating…' : 'Out for delivery'}
                </Button>
              ) : undefined
            }
            onSaveDraft={() => {}}
            onIssue={submitFinalInvoice}
            issueLoading={createFinalDraft.isPending || issueFinal.isPending}
            draftExists={!!finalInvoice}
            issued={isFinalLocked || finalSubmitted}
            disableEditing={!canEditFinalInvoiceForm || !canIssueFinalInvoice}
            issueDisabled={!canIssueFinalInvoice}
            issueButtonLabel="Submit invoice"
            showIssueButtonWhenReadOnly={canEditFinalInvoiceForm}
            allowSubmitWithoutDraft
            hideSaveDraftButton
            showPrintOnly={true}
            pdfUrl={finalInvoice?.pdfUrl}
            printAreaRef={finalPrintAreaRef}
            issuedShareAdvanced={
              finalInvoice?.status === 'ISSUED'
                ? {
                    orderId: order.id,
                    invoiceLabelForFile: finalInvoice.code?.trim() || `IN${order.id}`,
                    shareFileLabelPrefix: 'Final',
                    buildWhatsAppMessage: buildFinalWhatsAppMessage,
                    customerPhone: customer.phone,
                    printStyleId: 'order-final-inline-print-style',
                    printRootId: 'order-final-inline-print-root',
                    printCloneClass: 'order-final-inline-print-clone',
                  }
                : undefined
            }
            catalog={catalog ?? undefined}
            catalogMatrix={catalogMatrix}
            tagPrintOrderLabel={order.id}
            tagBrandName={
              summary.branch?.itemTagBrandName?.trim() ||
              summary.branch?.name?.trim() ||
              branding?.businessName?.trim() ||
              undefined
            }
            tagLabelPickupDate={order.pickupDate}
            tagLabelWalkIn={order.orderSource === 'WALK_IN'}
          />
          {(() => {
            const st = finalSubtotal(finalItems);
            const disc = finalDiscountType === 'percent' ? Math.round(st * finalDiscountValue / 100) : finalDiscountValue;
            const taxableAfterDisc = Math.max(0, st - disc);
            const tax = Math.round(taxableAfterDisc * finalTaxPercent / 100);
            const finalTotal = st - disc + tax;
            return (
              <>
                <div className="mt-4 pt-4 border-t space-y-1 text-right">
                  <p className="text-base">
                    Subtotal: {formatMoney(st)} · Discount {finalDiscountType === 'percent' ? `(${finalDiscountValue}%)` : `(₹)`}: -{formatMoney(disc)} · Tax ({finalTaxPercent}%): {formatMoney(tax)}
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
                  {summary.branch?.footerNote?.trim() ? (
                    <p className="whitespace-pre-line">{summary.branch.footerNote.trim()}</p>
                  ) : (
                    <p>
                      {[
                        summary.branch?.address ?? '',
                        branding?.email ?? '',
                        summary.branch?.phone ?? branding?.phone ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </CardContent>
        </div>
      </Card>
      </div>
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

