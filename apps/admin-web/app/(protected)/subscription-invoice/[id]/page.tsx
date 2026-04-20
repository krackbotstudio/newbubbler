'use client';

import { useRef, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, getApiOrigin } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatMoney, formatDate } from '@/lib/format';
import { ArrowLeft, Printer, Download, Share2, Banknote } from 'lucide-react';
import { useConfirmSubscriptionPayment } from '@/hooks/useSubscriptionInvoices';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';

const PAYMENT_PROVIDERS = ['UPI', 'CARD', 'CASH', 'RAZORPAY', 'NONE'] as const;

interface SubscriptionPurchaseSnapshot {
  validTill?: string;
  maxPickups?: number;
  kgLimit?: number | null;
  itemsLimit?: number | null;
}

interface BrandingSnapshot {
  businessName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  termsAndConditions?: string | null;
  footerNote?: string | null;
}

interface MainBranch {
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  footerNote?: string | null;
}

interface SubscriptionInvoiceResponse {
  id: string;
  subscriptionId: string;
  type: string;
  status: string;
  code: string | null;
  subtotal: number;
  tax: number;
  total: number;
  discountPaise: number | null;
  issuedAt: string | null;
  pdfUrl: string | null;
  paymentStatus: string;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number; amount: number }>;
  brandingSnapshotJson: BrandingSnapshot | null;
  subscriptionPurchaseSnapshotJson: SubscriptionPurchaseSnapshot | null;
  mainBranch: MainBranch | null;
  customerName: string | null;
  customerPhone: string | null;
  planName: string | null;
  planDescription: string | null;
}

function fetchSubscriptionInvoice(subscriptionId: string): Promise<SubscriptionInvoiceResponse> {
  return api.get<SubscriptionInvoiceResponse>(`/admin/subscriptions/${subscriptionId}/invoice`).then((r) => r.data);
}

const PRINT_STYLE_ID = 'subscription-invoice-print-style';

export default function SubscriptionInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const subscriptionId = params.id as string;
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<string>('UPI');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<string>('');

  const confirmPayment = useConfirmSubscriptionPayment(subscriptionId);
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'subscriptions', subscriptionId, 'invoice'],
    queryFn: () => fetchSubscriptionInvoice(subscriptionId),
    enabled: !!subscriptionId,
  });

  const handlePrint = useCallback(() => {
    const el = printAreaRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add('subscription-invoice-print-clone');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('id', 'subscription-invoice-print-root');
    wrapper.style.cssText =
      'position:absolute;left:0;top:0;width:100%;margin:0;padding:0;z-index:99999;pointer-events:none;';
    wrapper.appendChild(clone);
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `@media print{html,body{margin:0!important;padding:0!important}body>*{display:none!important}body>#subscription-invoice-print-root{display:block!important}#subscription-invoice-print-root{position:static!important;margin:0!important;padding:0!important}.subscription-invoice-print-clone{margin:0!important;padding:0 0.5rem 0.5rem!important;max-width:100%!important;page-break-inside:avoid!important}.subscription-invoice-print-clone.sub-inv-print-view *{margin-top:0.25rem!important;margin-bottom:0!important}.subscription-invoice-print-clone [class*="pb-4"]{padding-bottom:0.25rem!important}.subscription-invoice-print-clone [class*="py-2"]{padding-top:0.15rem!important;padding-bottom:0.15rem!important}.subscription-invoice-print-clone [class*="mt-4"],[class*="mt-6"]{margin-top:0.25rem!important}.subscription-invoice-print-clone [class*="pt-4"]{padding-top:0.25rem!important}.subscription-invoice-print-clone table th,.subscription-invoice-print-clone table td{padding-top:0.15rem!important;padding-bottom:0.15rem!important}.subscription-invoice-print-clone .sub-inv-logo{max-height:3.5rem!important;height:3.5rem!important;width:auto!important}}@media screen{#subscription-invoice-print-root{display:none!important}}`;
    document.body.appendChild(style);
    document.body.insertBefore(wrapper, document.body.firstChild);
    requestAnimationFrame(() => {
      window.print();
      requestAnimationFrame(() => {
        wrapper.remove();
        document.getElementById(PRINT_STYLE_ID)?.remove();
      });
    });
  }, []);

  const handleDownload = useCallback(async () => {
    const element = printAreaRef.current;
    if (element) {
      setDownloadLoading(true);
      try {
        element.classList.add('pdf-capture');
        await new Promise((r) => setTimeout(r, 150));
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf()
          .set({
            margin: 10,
            filename: `subscription-invoice-${data?.code ?? data?.id ?? 'invoice'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(element)
          .save();
      } catch {
        if (data?.pdfUrl) {
          const token = getToken();
          const fullUrl = data.pdfUrl.startsWith('http') ? data.pdfUrl : `${getApiOrigin()}${data.pdfUrl}`;
          const res = await fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subscription-invoice-${data?.code ?? data?.id ?? 'invoice'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            window.open(fullUrl, '_blank');
          }
        }
      } finally {
        element.classList.remove('pdf-capture');
        setDownloadLoading(false);
      }
      return;
    }
    if (!data?.pdfUrl) return;
    setDownloadLoading(true);
    try {
      const token = getToken();
      const fullUrl = data.pdfUrl.startsWith('http') ? data.pdfUrl : `${getApiOrigin()}${data.pdfUrl}`;
      const res = await fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Failed to fetch PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscription-invoice-${data?.code ?? data?.id ?? 'invoice'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(data.pdfUrl.startsWith('http') ? data.pdfUrl : `${getApiOrigin()}${data.pdfUrl}`, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }, [data?.pdfUrl, data?.code, data?.id]);

  const thankYouNote = 'Thank you for your subscription! Please find your invoice attached.';
  const handleShare = useCallback(async () => {
    const fullPdfUrl = data?.pdfUrl
      ? data.pdfUrl.startsWith('http')
        ? data.pdfUrl
        : `${getApiOrigin()}${data.pdfUrl}`
      : null;
    const messageWithCode = data?.code ? `Subscription Invoice ${data.code}` : null;
    const textFallback = [thankYouNote, messageWithCode, fullPdfUrl].filter(Boolean).join('\n\n');
    if (!textFallback) return;
    setShareLoading(true);
    try {
      if (fullPdfUrl && typeof navigator !== 'undefined' && navigator.share) {
        const token = getToken();
        const res = await fetch(fullPdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], 'subscription-invoice.pdf', { type: 'application/pdf' });
          if (navigator.canShare?.({ files: [file], text: thankYouNote })) {
            await navigator.share({ files: [file], text: thankYouNote });
            return;
          }
        }
      }
    } catch {
      /* fallback to wa.me */
    } finally {
      setShareLoading(false);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(textFallback)}`, '_blank', 'noopener,noreferrer');
  }, [data?.code, data?.pdfUrl]);

  const invoicePaid = data?.paymentStatus === 'PAID' || data?.paymentStatus === 'CAPTURED';
  const handleConfirmPayment = useCallback(async () => {
    const amount = Math.round(parseFloat(paymentAmountRupees || '0') * 100);
    if (amount <= 0) {
      toast.error('Enter a valid amount in rupees');
      return;
    }
    try {
      await confirmPayment.mutateAsync({
        provider: paymentProvider,
        status: 'CAPTURED',
        amountPaise: amount,
      });
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentAmountRupees('');
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  }, [paymentProvider, paymentAmountRupees, confirmPayment]);

  if (!subscriptionId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-destructive">Invalid subscription</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-destructive">Failed to load invoice or not found.</p>
      </div>
    );
  }

  const branding = data.brandingSnapshotJson;
  const mainBranch = data.mainBranch;
  const snapshot = data.subscriptionPurchaseSnapshotJson;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-wrap gap-2 print:hidden">
          {!invoicePaid && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setPaymentAmountRupees(data ? String((data.total / 100).toFixed(2)) : '');
                setPaymentDialogOpen(true);
              }}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Record payment
            </Button>
          )}
          <Button variant="default" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloadLoading}>
            <Download className="mr-2 h-4 w-4" />
            {downloadLoading ? 'Downloading…' : 'Download PDF'}
          </Button>
          <Button variant="default" size="sm" onClick={handleShare} disabled={shareLoading}>
            <Share2 className="mr-2 h-4 w-4" />
            {shareLoading ? 'Sharing…' : 'Share on WhatsApp'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div
            ref={printAreaRef}
            className="bg-white text-black dark:bg-white dark:text-black p-6 max-w-2xl mx-auto space-y-4 sub-inv-print-view"
          >
            {/* Brand logo (top left) + business name + branch */}
            <div className="flex gap-4 border-b pb-4 items-start justify-start">
              <div className="flex-shrink-0 flex justify-start">
                {branding?.logoUrl ? (
                  <img
                    src={
                      branding.logoUrl.startsWith('http')
                        ? branding.logoUrl
                        : `${getApiOrigin()}${branding.logoUrl}`
                    }
                    alt="Brand logo"
                    className="sub-inv-logo h-14 w-auto max-h-14 object-contain object-left"
                  />
                ) : (
                  <div className="h-14 w-24 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                    Logo
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-lg">{branding?.businessName ?? 'Company'}</p>
                {mainBranch && (
                  <p className="text-sm font-medium text-gray-600 mt-0.5">{mainBranch.name}</p>
                )}
              </div>
            </div>

            {/* Invoice number */}
            <div className="flex flex-nowrap gap-4 items-start justify-between">
              <div className="min-w-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm flex-shrink">
                <p className="font-medium mb-0.5">Invoice number</p>
                <p className="text-gray-600 text-xs">{data.code ?? '—'}</p>
                {data.issuedAt && (
                  <p className="text-gray-600 text-xs">
                    Issued: {formatDate(data.issuedAt)}
                    {data.issuedAt.includes('T') &&
                      ' ' +
                        new Date(data.issuedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                  </p>
                )}
              </div>
            </div>

            {/* Customer details (left) | PAN, GST, Main branch address (right) - same as Final */}
            <div className="flex flex-wrap gap-4 items-start rounded-md bg-gray-50 p-3 text-sm">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium mb-1">Customer</p>
                <p>{data.customerName ?? data.customerPhone ?? '—'}</p>
                {data.customerPhone && data.customerName && (
                  <p className="text-gray-600">{data.customerPhone}</p>
                )}
                <p className="font-medium text-gray-800 mt-1">
                  {data.planName ?? 'Subscription purchase'}
                </p>
                {/* Subscription description: plan description or validity/limits */}
                {(data.planDescription?.trim() || snapshot) && (
                  <div className="text-gray-600 text-sm mt-0.5 space-y-0.5">
                    {data.planDescription?.trim() && (
                      <p>{data.planDescription.trim()}</p>
                    )}
                    {snapshot && (
                      <p className="text-xs">
                        Valid till: {snapshot.validTill ?? '—'} · Pickups: {snapshot.maxPickups ?? '—'}
                        {snapshot.kgLimit != null && ` · Weight limit: ${snapshot.kgLimit} kg`}
                        {snapshot.itemsLimit != null && ` · Items limit: ${snapshot.itemsLimit}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right text-gray-600 space-y-0.5">
                {branding?.panNumber && <p>PAN: {branding.panNumber}</p>}
                {branding?.gstNumber && <p>GST: {branding.gstNumber}</p>}
                {mainBranch && (
                  <>
                    <p className="font-medium text-gray-900">{mainBranch.name}</p>
                    <p>{mainBranch.address}</p>
                    {mainBranch.phone && <p>{mainBranch.phone}</p>}
                    {mainBranch.email && <p>{mainBranch.email}</p>}
                  </>
                )}
              </div>
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit (₹)</th>
                    <th className="text-right py-2">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-1.5">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {data.planDescription?.trim() && (
                            <div className="text-xs text-gray-600 mt-0.5">{data.planDescription.trim()}</div>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-1.5">{item.quantity}</td>
                      <td className="text-right py-1.5">{formatMoney(item.unitPrice)}</td>
                      <td className="text-right py-1.5">{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t space-y-1 text-right">
              <p className="text-base">
                Subtotal: {formatMoney(data.subtotal)}
                {data.tax > 0 && <> · Tax: {formatMoney(data.tax)}</>}
                {data.discountPaise != null && data.discountPaise > 0 && (
                  <> · Discount: -{formatMoney(data.discountPaise)}</>
                )}
              </p>
              <p className="text-2xl font-bold">Total: {formatMoney(data.total)}</p>
              <p className="text-sm text-gray-600">Payment: {data.paymentStatus}</p>
            </div>

            {/* Terms and Conditions — then branch footer note (same order as Ack/Final invoices) */}
            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold text-gray-700 text-sm mb-1">Terms and Conditions</p>
              {branding?.termsAndConditions?.trim() ? (
                <div className="text-xs text-gray-600 whitespace-pre-line">{branding.termsAndConditions.trim()}</div>
              ) : (
                <p className="text-xs text-gray-500 italic">No terms and conditions specified.</p>
              )}
            </div>

            <div className="mt-6 pt-4 text-center text-sm text-gray-600 space-y-1">
              {(mainBranch?.footerNote ?? branding?.footerNote)?.trim() ? (
                <p className="whitespace-pre-line">{(mainBranch?.footerNote ?? branding?.footerNote)!.trim()}</p>
              ) : (
                <p>
                  {[
                    mainBranch?.address ?? branding?.address ?? '',
                    mainBranch?.email ?? branding?.email ?? '',
                    mainBranch?.phone ?? branding?.phone ?? '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm payment received</DialogTitle>
            <DialogDescription>
              Record that the customer has paid for this subscription (UPI, Card, Cash, etc.). This will set the invoice payment status to Paid.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Payment method</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentProvider}
                onChange={(e) => setPaymentProvider(e.target.value)}
              >
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentAmountRupees}
                onChange={(e) => setPaymentAmountRupees(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={confirmPayment.isPending || !paymentAmountRupees}
            >
              {confirmPayment.isPending ? 'Saving…' : 'Confirm payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
