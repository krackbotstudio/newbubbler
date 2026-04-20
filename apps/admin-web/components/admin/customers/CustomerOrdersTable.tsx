'use client';

import { useCallback, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrders } from '@/hooks/useOrders';
import { useOrderSummary } from '@/hooks/useOrderSummary';
import { useBranding } from '@/hooks/useBranding';
import { useCatalogItemsWithMatrix } from '@/hooks/useCatalog';
import { useBranches } from '@/hooks/useBranches';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { InvoicePrintView } from '@/components/admin/customers/InvoicePrintView';
import { formatDate } from '@/lib/format';
import { getApiOrigin } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { mergeInvoiceDisplayBranding } from '@/lib/invoice-display-branding';
import type { OrderRecord } from '@/types';
import { isBranchFilterLocked, type Role } from '@/lib/auth';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { Eye } from 'lucide-react';

const SERVICE_LABELS: Record<string, string> = {
  WASH_FOLD: 'Wash & Fold',
  WASH_IRON: 'Wash & Iron',
  STEAM_IRON: 'Steam Ironing',
  DRY_CLEAN: 'Dry Cleaning',
  HOME_LINEN: 'Home Linen',
  SHOES: 'Shoes',
  ADD_ONS: 'Add ons',
};

export interface CustomerOrdersTableProps {
  userId: string;
  role?: Role;
  userBranchId?: string | null;
}

type InvoiceModalType = 'ACK' | 'FINAL';

export function CustomerOrdersTable({ userId, role, userBranchId }: CustomerOrdersTableProps) {
  const router = useRouter();
  const branchLocked = !!role && isBranchFilterLocked(role, userBranchId);
  const [branchIdFilter, setBranchIdFilter] = useState<string>(() => (branchLocked ? userBranchId ?? '' : ''));
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [invoiceModal, setInvoiceModal] = useState<{ orderId: string; type: InvoiceModalType } | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const invoicePrintRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  const effectiveBranchId = branchLocked ? (userBranchId ?? '') : branchIdFilter;
  const { data: branches = [] } = useBranches();
  const { data, isLoading, error } = useOrders({
    customerId: userId,
    limit,
    cursor,
    branchId: effectiveBranchId || undefined,
  });

  const handleRowClick = useCallback(
    (orderId: string) => {
      router.push(`/orders/${orderId}`);
    },
    [router]
  );

  const handleNext = useCallback(() => {
    if (data?.nextCursor) setCursor(data.nextCursor);
  }, [data?.nextCursor]);

  const handlePrev = useCallback(() => {
    setCursor(undefined);
  }, []);

  const orders = data?.data ?? [];

  const { data: orderSummary, isLoading: summaryLoading } = useOrderSummary(invoiceModal?.orderId ?? null);
  const { data: branding } = useBranding();
  const { data: catalogMatrixData } = useCatalogItemsWithMatrix();
  const catalogMatrix = catalogMatrixData
    ? {
        items: catalogMatrixData.items,
        serviceCategories: catalogMatrixData.serviceCategories,
        segmentCategories: catalogMatrixData.segmentCategories ?? [],
      }
    : undefined;

  const invoice = orderSummary?.invoices?.find(
    (inv) => inv.type === (invoiceModal?.type === 'ACK' ? 'ACKNOWLEDGEMENT' : 'FINAL')
  );
  const ackInvoice = orderSummary?.invoices?.find((inv) => inv.type === 'ACKNOWLEDGEMENT');
  const pdfUrl = invoice?.pdfUrl ? (invoice.pdfUrl.startsWith('http') ? invoice.pdfUrl : `${getApiOrigin()}${invoice.pdfUrl}`) : null;

  const hasSubscription = Boolean(orderSummary?.subscription && orderSummary?.subscriptionUsage);
  const subscriptionUnit =
    orderSummary?.subscription?.kgLimit != null
      ? 'KG'
      : orderSummary?.subscription?.itemsLimit != null
        ? 'Nos'
        : undefined;
  const subscriptionUsageRowIndex =
    invoiceModal?.type === 'FINAL' && hasSubscription && (invoice?.items?.length ?? 0) > 0 ? 0 : undefined;

  const mergedInvoiceBranding = useMemo(
    () =>
      mergeInvoiceDisplayBranding(invoice?.brandingSnapshotJson, branding ?? undefined, {
        branchLogoUrl: orderSummary?.branch?.logoUrl ?? null,
        branchUpdatedAt: orderSummary?.branch?.updatedAt ?? null,
      }),
    [invoice, branding, orderSummary?.branch?.logoUrl, orderSummary?.branch?.updatedAt],
  );
  const brandingForPrintView = mergedInvoiceBranding
    ? {
        businessName: mergedInvoiceBranding.businessName,
        logoUrl: mergedInvoiceBranding.logoUrl,
        address: mergedInvoiceBranding.address,
        phone: mergedInvoiceBranding.phone,
        email: mergedInvoiceBranding.email,
        panNumber: mergedInvoiceBranding.panNumber,
        gstNumber: mergedInvoiceBranding.gstNumber,
        termsAndConditions: mergedInvoiceBranding.termsAndConditions,
      }
    : null;
  const invoiceLogoCacheBuster = mergedInvoiceBranding?.logoUrlCacheBuster ?? branding?.updatedAt ?? undefined;

  const printStyleId = 'customer-invoice-print-style';
  const handlePrint = useCallback(() => {
    const el = invoicePrintRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add('customer-invoice-print-clone');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('id', 'customer-invoice-print-root');
    wrapper.style.cssText = 'position:absolute;left:0;top:0;width:100%;margin:0;padding:0;z-index:99999;pointer-events:none;';
    wrapper.appendChild(clone);
    const style = document.createElement('style');
    style.id = printStyleId;
    style.textContent = `@media print{html,body{margin:0!important;padding:0!important}body #customer-invoice-print-root,body #customer-invoice-print-root *{visibility:visible!important}body>*{display:none!important}body>#customer-invoice-print-root{display:block!important}#customer-invoice-print-root{position:static!important;margin:0!important;padding:0!important}.customer-invoice-print-clone{margin:0!important;padding:0 0.5rem 0.5rem!important;max-width:100%!important;page-break-inside:avoid!important}.customer-invoice-print-clone.invoice-print-view{padding:0.25rem 0.5rem!important;gap:0.25rem!important}.customer-invoice-print-clone.invoice-print-view>*{margin-top:0.25rem!important;margin-bottom:0!important}.customer-invoice-print-clone .invoice-print-header-logo{border-bottom-width:1px!important;padding-bottom:0.25rem!important}.customer-invoice-print-clone [class*="pb-4"]{padding-bottom:0.25rem!important}.customer-invoice-print-clone [class*="py-2"]{padding-top:0.15rem!important;padding-bottom:0.15rem!important}.customer-invoice-print-clone [class*="py-3"]{padding-top:0.2rem!important;padding-bottom:0.2rem!important}.customer-invoice-print-clone [class*="p-3"]{padding:0.25rem!important}.customer-invoice-print-clone [class*="p-2"]{padding:0.2rem!important}.customer-invoice-print-clone [class*="mt-4"],[class*="mt-6"]{margin-top:0.25rem!important}.customer-invoice-print-clone [class*="pt-4"]{padding-top:0.25rem!important}.customer-invoice-print-clone table th,.customer-invoice-print-clone table td{padding-top:0.15rem!important;padding-bottom:0.15rem!important}.customer-invoice-print-clone img{max-height:2rem!important;height:2rem!important}}@media screen{#customer-invoice-print-root{display:none!important}}`;
    document.body.appendChild(style);
    document.body.insertBefore(wrapper, document.body.firstChild);
    requestAnimationFrame(() => {
      window.print();
      requestAnimationFrame(() => {
        wrapper.remove();
        document.getElementById(printStyleId)?.remove();
      });
    });
  }, []);

  const handleDownload = useCallback(async () => {
    const element = invoicePrintRef.current;
    if (element) {
      setDownloadLoading(true);
      try {
        element.classList.add('pdf-capture');
        await new Promise((r) => setTimeout(r, 150));
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf()
          .set({
            margin: 10,
            filename: `invoice-${invoice?.code ?? invoiceModal?.type ?? 'invoice'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(element)
          .save();
      } catch (_) {
        if (pdfUrl) {
          const token = getToken();
          const res = await fetch(pdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-${invoice?.code ?? invoiceModal?.type ?? 'invoice'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            window.open(pdfUrl, '_blank');
          }
        }
      } finally {
        element.classList.remove('pdf-capture');
        setDownloadLoading(false);
      }
      return;
    }
    if (!pdfUrl) return;
    setDownloadLoading(true);
    try {
      const token = getToken();
      const res = await fetch(pdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Failed to fetch PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.code ?? invoiceModal?.type ?? 'invoice'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(pdfUrl, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }, [pdfUrl, invoice?.code, invoiceModal?.type]);

  const thankYouNote = 'Thank you for your order! Please find your invoice attached.';
  const handleShare = useCallback(async () => {
    const label = invoiceModal?.type === 'ACK' ? 'Acknowledgement' : 'Final';
    const fullPdfUrl = pdfUrl ?? null;
    const messageWithCode = invoice?.code ? `${label} Invoice ${invoice.code}` : null;
    const textFallback = [thankYouNote, messageWithCode, fullPdfUrl].filter(Boolean).join('\n\n');
    if (!textFallback) return;
    setShareLoading(true);
    try {
      if (fullPdfUrl && typeof navigator !== 'undefined' && navigator.share) {
        const token = getToken();
        const res = await fetch(fullPdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], 'invoice.pdf', { type: 'application/pdf' });
          if (navigator.canShare?.({ files: [file], text: thankYouNote })) {
            await navigator.share({ files: [file], text: thankYouNote });
            return;
          }
        }
      }
    } catch (_) {
      /* fallback to wa.me */
    } finally {
      setShareLoading(false);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(textFallback)}`, '_blank', 'noopener,noreferrer');
  }, [invoice?.code, invoiceModal?.type, pdfUrl]);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4">
        <CardTitle>Order history</CardTitle>
        <div className="flex items-center gap-2">
          <label htmlFor="orders-branch-filter" className="text-sm text-muted-foreground whitespace-nowrap">
            Branch
          </label>
          {branchLocked ? (
            <LockedBranchSelect branchId={userBranchId} selectClassName="h-9 min-w-[160px]" />
          ) : (
            <select
              id="orders-branch-filter"
              className="h-9 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm"
              value={effectiveBranchId}
              onChange={(e) => setBranchIdFilter(e.target.value)}
              title="Filter by branch"
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
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive mb-4">
            Failed to load orders: {(error as Error).message}
          </p>
        ) : null}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders"
            description="This customer has no orders yet."
          />
        ) : (
          <>
            <div className="overflow-x-auto -mx-1 px-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Pickup date</TableHead>
                  <TableHead>Ack invoice</TableHead>
                  <TableHead>Final invoice</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: import('@/types').AdminOrderListRow) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(order.id)}
                  >
                    <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.branchName ?? '—'}
                    </TableCell>
                    <TableCell>{SERVICE_LABELS[order.serviceType] ?? order.serviceType}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={order.paymentStatus} />
                      {order.paymentFailureReason && (
                        <span className="block text-xs text-destructive mt-0.5" title={order.paymentFailureReason}>
                          Failed: {order.paymentFailureReason.slice(0, 20)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(order.pickupDate)}</TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.ackIssuedAt ? (
                        <button
                          type="button"
                          className="text-primary hover:underline focus:outline-none focus:underline"
                          onClick={() => setInvoiceModal({ orderId: order.id, type: 'ACK' })}
                        >
                          {formatDate(order.ackIssuedAt)}
                        </button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.finalIssuedAt ? (
                        <button
                          type="button"
                          className="text-primary hover:underline focus:outline-none focus:underline"
                          onClick={() => setInvoiceModal({ orderId: order.id, type: 'FINAL' })}
                        >
                          {formatDate(order.finalIssuedAt)}
                        </button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.status === 'CANCELLED' && (order.cancelledAt || order.updatedAt) ? (
                        <span title={order.cancellationReason ?? undefined}>
                          {formatDate(order.cancelledAt ?? order.updatedAt)}
                          {order.cancellationReason && (
                            <span className="block text-xs truncate max-w-[120px]">{order.cancellationReason.slice(0, 15)}…</span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {order.billTotalPaise != null ? `₹${(order.billTotalPaise / 100).toFixed(0)}` : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(order.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={!cursor}
                onClick={handlePrev}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.nextCursor}
                onClick={handleNext}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!invoiceModal} onOpenChange={(open) => !open && setInvoiceModal(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {invoiceModal?.type === 'ACK' ? 'Acknowledgement' : 'Final'} Invoice
            {invoice?.code && ` · ${invoice.code}`}
          </DialogTitle>
        </DialogHeader>
        {summaryLoading ? (
          <div className="min-h-[300px] flex items-center justify-center">
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : invoice && orderSummary ? (
          <>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="default" size="sm" onClick={handlePrint}>
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloadLoading}
              >
                {downloadLoading ? 'Downloading…' : 'Download PDF'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleShare}
                disabled={shareLoading}
              >
                {shareLoading ? 'Sharing…' : 'Share on WhatsApp'}
              </Button>
            </div>
            <div className="border rounded overflow-auto flex-1 min-h-[400px] max-h-[60vh] print:max-h-none customer-invoice-print-area">
              <InvoicePrintView
                ref={invoicePrintRef}
                summary={orderSummary}
                invoice={invoice}
                type={invoiceModal!.type}
                branding={brandingForPrintView}
                logoUrlCacheBuster={invoiceLogoCacheBuster}
                ackInvoice={invoiceModal!.type === 'FINAL' ? ackInvoice ?? null : undefined}
                catalogMatrix={catalogMatrix ?? null}
                subscriptionUnit={subscriptionUnit}
                subscriptionUsageRowIndex={subscriptionUsageRowIndex}
              />
            </div>
          </>
        ) : invoiceModal && !summaryLoading ? (
          <p className="text-sm text-muted-foreground py-8">
            No invoice data available for this order.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
