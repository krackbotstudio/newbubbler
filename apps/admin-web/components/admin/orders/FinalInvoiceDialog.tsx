'use client';

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InvoicePrintView } from '@/components/admin/customers/InvoicePrintView';
import { getApiOrigin } from '@/lib/api';
import { mergeInvoiceDisplayBranding } from '@/lib/invoice-display-branding';
import { formatMoney, phoneDigitsForWhatsApp } from '@/lib/format';
import { getOrderStatusLabel } from '@/components/shared/StatusBadge';
import { CUSTOMER_APP_URL } from '@/lib/customer-app-url';
import { useIssuedInvoiceShareActions } from '@/hooks/useIssuedInvoiceShareActions';
import type { OrderAdminSummary } from '@/types';
import type { BrandingSettings } from '@/types/branding';
import type { CatalogMatrixResponse } from '@/types/catalog';

export interface FinalInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: OrderAdminSummary;
  finalInvoice: OrderAdminSummary['invoices'][number];
  ackInvoice: OrderAdminSummary['invoices'][number] | undefined;
  branding: BrandingSettings | null | undefined;
  catalogMatrix?: CatalogMatrixResponse | null;
  orderId: string;
}

const PRINT_STYLE_ID = 'order-final-invoice-dialog-print-style';
const PRINT_ROOT_ID = 'order-final-invoice-dialog-print-root';
const PRINT_CLONE_CLASS = 'order-final-invoice-dialog-print-clone';

export function FinalInvoiceDialog({
  open,
  onOpenChange,
  summary,
  finalInvoice,
  ackInvoice,
  branding,
  catalogMatrix,
  orderId,
}: FinalInvoiceDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const pdfUrl = finalInvoice.pdfUrl
    ? finalInvoice.pdfUrl.startsWith('http')
      ? finalInvoice.pdfUrl
      : `${getApiOrigin()}${finalInvoice.pdfUrl}`
    : null;

  const merged = mergeInvoiceDisplayBranding(finalInvoice.brandingSnapshotJson, branding ?? undefined, {
    branchLogoUrl: summary.branch?.logoUrl ?? null,
    branchUpdatedAt: summary.branch?.updatedAt ?? null,
  });
  const brandingForView = merged
    ? {
        businessName: merged.businessName,
        logoUrl: merged.logoUrl,
        address: merged.address,
        phone: merged.phone,
        email: merged.email,
        panNumber: merged.panNumber,
        gstNumber: merged.gstNumber,
        termsAndConditions: merged.termsAndConditions,
      }
    : null;
  const logoUrlCacheBuster = merged?.logoUrlCacheBuster ?? branding?.updatedAt ?? undefined;

  const hasSubscription = Boolean(summary.subscription && summary.subscriptionUsage);
  const subscriptionUnit =
    summary.subscription?.kgLimit != null
      ? 'KG'
      : summary.subscription?.itemsLimit != null
        ? 'Nos'
        : undefined;
  const subscriptionUsageRowIndex =
    hasSubscription && (finalInvoice.items?.length ?? 0) > 0 ? 0 : undefined;

  const invoiceLabelForFile = finalInvoice.code?.trim() || `IN${orderId}`;

  const buildWhatsAppMessage = useCallback(() => {
    const customerName = summary.customer?.name?.trim() || 'there';
    const statusLabel = getOrderStatusLabel(summary.order.status);
    const invoiceLine = `Final invoice: ${invoiceLabelForFile}`;
    const amountLine = `Amount payable (final): *${formatMoney(finalInvoice.total)}*`;
    const parts: string[] = [
      `Hello ${customerName},`,
      '',
      'Thanks for opting our service.',
      '',
      `Order number: ${orderId}`,
      `Status: *${statusLabel}*`,
      '',
      invoiceLine,
      amountLine,
      '',
      `Open our app: ${CUSTOMER_APP_URL}`,
    ];
    return parts.join('\n');
  }, [finalInvoice.total, invoiceLabelForFile, orderId, summary.customer?.name, summary.order.status]);

  const { handlePrint, handleDownload, handleWhatsAppShare, downloadLoading, shareLoading } =
    useIssuedInvoiceShareActions(printRef, {
      pdfUrl,
      orderId,
      invoiceLabelForFile,
      buildWhatsAppMessage,
      customerPhone: summary.customer?.phone,
      shareFileLabelPrefix: 'Final',
      printStyleId: PRINT_STYLE_ID,
      printRootId: PRINT_ROOT_ID,
      printCloneClass: PRINT_CLONE_CLASS,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full"
        showClose={true}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle>
            Final invoice
            {invoiceLabelForFile ? ` · ${invoiceLabelForFile}` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View, download, print, or share the issued final invoice for this order.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <InvoicePrintView
            ref={printRef}
            summary={summary}
            invoice={finalInvoice}
            type="FINAL"
            ackInvoice={ackInvoice ?? null}
            branding={brandingForView}
            logoUrlCacheBuster={logoUrlCacheBuster}
            catalogMatrix={catalogMatrix ?? null}
            subscriptionUnit={subscriptionUnit}
            subscriptionUsageRowIndex={subscriptionUsageRowIndex}
          />
        </div>

        <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-6 py-3 shadow-[0_-6px_16px_-8px_rgba(0,0,0,0.12)] backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloadLoading}>
            {downloadLoading ? 'Downloading…' : 'Download PDF'}
          </Button>
          <Button variant="default" size="sm" onClick={handleWhatsAppShare} disabled={shareLoading}>
            {shareLoading ? 'Preparing…' : 'Share on WhatsApp'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
