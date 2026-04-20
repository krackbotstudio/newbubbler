'use client';

import { useState, useEffect, useMemo, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InvoiceItemType, InvoiceOrderMode } from '@/types';
import type { LaundryItem, CatalogMatrixResponse } from '@/types/catalog';
import type { ServiceType } from '@/types/order';
import { formatMoney } from '@/lib/format';
import { getApiOrigin } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getToken } from '@/lib/auth';
import { useIssuedInvoiceShareActions } from '@/hooks/useIssuedInvoiceShareActions';
import { AddItemsToInvoiceDialog } from './AddItemsToInvoiceDialog';
import { PrintLineTagDialog, type PrintLineTagPayload } from './PrintLineTagDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CatalogItemIcon } from '@/components/catalog/CatalogItemIcon';
import { Printer, Trash2 } from 'lucide-react';

const ITEM_TYPES: InvoiceItemType[] = ['SERVICE', 'FEE', 'ADDON', 'DRYCLEAN_ITEM', 'DISCOUNT'];

/** Service types for catalog-driven line add. Display labels for ACK/Final bill. */
export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'WASH_FOLD', label: 'Wash and Fold (KG)' },
  { value: 'WASH_IRON', label: 'Wash and Iron (KG)' },
  { value: 'STEAM_IRON', label: 'Steam Iron' },
  { value: 'DRY_CLEAN', label: 'Dry Clean' },
  { value: 'SHOES', label: 'Shoe' },
  { value: 'ADD_ONS', label: 'Add on' },
  { value: 'HOME_LINEN', label: 'Home Linen' },
];

export interface InvoiceLineRow {
  type: InvoiceItemType;
  name: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise?: number;
  /** Catalog matrix line: item + segment + service for edit dropdowns */
  catalogItemId?: string;
  segmentCategoryId?: string;
  serviceCategoryId?: string;
}

/** Config for issued invoice print / PDF / WhatsApp (Ack-dialog parity). */
export interface InvoiceBuilderIssuedShareAdvanced {
  orderId: string;
  invoiceLabelForFile: string;
  shareFileLabelPrefix: 'Ack' | 'Final';
  buildWhatsAppMessage: () => string;
  customerPhone: string | null | undefined;
  printStyleId: string;
  printRootId: string;
  printCloneClass: string;
}

interface InvoiceBuilderProps {
  items: InvoiceLineRow[];
  taxPaise: number;
  discountPaise: number;
  onItemsChange: (items: InvoiceLineRow[]) => void;
  onTaxChange: (v: number) => void;
  onDiscountChange: (v: number) => void;
  onSaveDraft: () => void;
  onIssue: () => void;
  saveDraftLoading?: boolean;
  issueLoading?: boolean;
  draftExists?: boolean;
  issued?: boolean;
  pdfUrl?: string | null;
  /** Catalog items with prices (legacy); when set, add-line uses service + item picker. */
  catalog?: LaundryItem[];
  /** Catalog matrix (Item + Segment + Service); when set, add-line is Item → Segment → Service → Qty only, no name override. */
  catalogMatrix?: CatalogMatrixResponse;
  /** ACK order type: SUBSCRIPTION_ONLY hides line items and shows subscription-only message. */
  orderMode?: InvoiceOrderMode;
  /** When SUBSCRIPTION_ONLY, save is disabled unless subscription usage (weight/items) is provided. */
  subscriptionOnlyCanSave?: boolean;
  /** When true, tax input is percentage; parent should convert to paise when building draft. */
  taxAsPercent?: boolean;
  /** When true, discount has type (percent | amount) and value. */
  discountAsPercentOrAmount?: boolean;
  /** Tax as percentage (0–100). Used when taxAsPercent is true. */
  taxPercent?: number;
  onTaxPercentChange?: (v: number) => void;
  /** Discount type when discountAsPercentOrAmount is true. */
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  onDiscountTypeChange?: (t: 'percent' | 'amount') => void;
  onDiscountValueChange?: (v: number) => void;
  /** Show "Prepaid" when total is 0 (subscription). */
  showPrepaidWhenZero?: boolean;
  /** Comments to include in invoice (display only here; pass to draft body from parent). */
  comments?: string;
  onCommentsChange?: (v: string) => void;
  /** When true, show Print button instead of PDF link/iframe when issued. */
  showPrintOnly?: boolean;
  /** Called when user clicks Print (e.g. window.print()). */
  onPrint?: () => void;
  /** Override label for the save draft button (e.g. "Save Ack Invoice"). */
  saveDraftLabel?: string;
  /** When true, save button is enabled (overrides internal disable logic). Use when parent allows save e.g. BOTH with subscription-only. */
  canSaveDraft?: boolean;
  /** When SUBSCRIPTION_ONLY and new subscription is selected, pass subscription amount so subtotal/tax/discount/total include it. */
  subscriptionAmountPaise?: number;
  /** When true, show Tax and Discount inputs even in SUBSCRIPTION_ONLY mode (e.g. when adding new subscription to invoice). */
  showTaxAndDiscountWhenNewSubscription?: boolean;
  /** Read-only subscription plan lines to show in the same items table (plan name, start date, qty, price). */
  subscriptionLines?: Array<{ planName: string; startDate: string; quantity: number; unitPricePaise: number }>;
  /** When true, Submit button is disabled (e.g. subscription would exceed limits after this invoice). Do not set when remaining after === 0. */
  issueDisabled?: boolean;
  /** When true, Submit is enabled even when draft does not exist (parent should save then issue on click). */
  allowSubmitWithoutDraft?: boolean;
  /** When true, hide Save draft; parent should use Submit only (e.g. save+issue in one handler). */
  hideSaveDraftButton?: boolean;
  /** For subscription-based invoice: show "KG" or "Nos" after the quantity for the subscription usage line. */
  subscriptionUnit?: 'KG' | 'Nos';
  /** Row index of the subscription usage line (e.g. 0) when subscriptionUnit is set. */
  subscriptionUsageRowIndex?: number;
  /** When set and invoice is issued, show "Share on WhatsApp" button. If pdfUrl is also set, tries to share PDF file + thank you note via system share (e.g. WhatsApp); else opens WhatsApp with this message. */
  whatsappShareMessage?: string | null;
  /** Optional thank you note included when sharing (default: "Thank you for your order! Please find your invoice attached."). */
  whatsappShareThankYouNote?: string;
  /** Ref to the print-area element (same as printed). When set, Download PDF generates PDF from this element so it matches the print view. */
  printAreaRef?: RefObject<HTMLElement | null>;
  /** When true (e.g. order cancelled), line items are read-only and Add items / tax / discount / comments cannot be edited. */
  disableEditing?: boolean;
  /** When set (e.g. order UUID on order detail), each line shows “Print tag” for thermal labels. */
  tagPrintOrderLabel?: string | null;
  /** Printed top line on line tags: branch “Short brand on item tag” (`itemTagBrandName`), then branch name, etc. (see order page). */
  tagBrandName?: string | null;
  /** Customer name shown on line tags. */
  tagCustomerName?: string | null;
  /**
   * When issued + showPrintOnly + printAreaRef, use Ack-dialog-style print / download / WhatsApp
   * (clone print, html2pdf, JPEG + wa.me) instead of the legacy toolbar.
   */
  issuedShareAdvanced?: InvoiceBuilderIssuedShareAdvanced | null;
}

function IssuedInvoiceShareToolbar({
  printRef,
  pdfUrl,
  config,
}: {
  printRef: RefObject<HTMLElement | null>;
  pdfUrl: string | null | undefined;
  config: InvoiceBuilderIssuedShareAdvanced;
}) {
  const resolvedPdf =
    pdfUrl?.startsWith('http') ? pdfUrl : pdfUrl ? `${getApiOrigin()}${pdfUrl}` : null;
  const { handlePrint, handleDownload, handleWhatsAppShare, downloadLoading, shareLoading } =
    useIssuedInvoiceShareActions(printRef, {
      pdfUrl: resolvedPdf,
      orderId: config.orderId,
      invoiceLabelForFile: config.invoiceLabelForFile,
      buildWhatsAppMessage: config.buildWhatsAppMessage,
      customerPhone: config.customerPhone,
      shareFileLabelPrefix: config.shareFileLabelPrefix,
      printStyleId: config.printStyleId,
      printRootId: config.printRootId,
      printCloneClass: config.printCloneClass,
    });
  return (
    <>
      <Button variant="outline" className="ack-print-hide" onClick={handlePrint}>
        Print
      </Button>
      <Button
        variant="outline"
        className="ack-print-hide"
        onClick={handleDownload}
        disabled={downloadLoading}
      >
        {downloadLoading ? 'Downloading…' : 'Download PDF'}
      </Button>
      <Button
        variant="default"
        className="ack-print-hide"
        onClick={handleWhatsAppShare}
        disabled={shareLoading}
      >
        {shareLoading ? 'Preparing…' : 'Share on WhatsApp'}
      </Button>
    </>
  );
}

export function InvoiceBuilder({
  items,
  taxPaise,
  discountPaise,
  onItemsChange,
  onTaxChange,
  onDiscountChange,
  onSaveDraft,
  onIssue,
  saveDraftLoading,
  issueLoading,
  draftExists,
  issued,
  pdfUrl,
  catalog,
  catalogMatrix,
  orderMode = 'INDIVIDUAL',
  subscriptionOnlyCanSave = false,
  taxAsPercent = false,
  discountAsPercentOrAmount = false,
  taxPercent = 0,
  onTaxPercentChange,
  discountType = 'amount',
  discountValue = 0,
  onDiscountTypeChange,
  onDiscountValueChange,
  showPrepaidWhenZero = false,
  comments = '',
  onCommentsChange,
  showPrintOnly = false,
  onPrint,
  saveDraftLabel,
  canSaveDraft,
  subscriptionAmountPaise,
  showTaxAndDiscountWhenNewSubscription = false,
  subscriptionLines,
  issueDisabled = false,
  allowSubmitWithoutDraft = false,
  hideSaveDraftButton = false,
  subscriptionUnit,
  subscriptionUsageRowIndex,
  whatsappShareMessage,
  whatsappShareThankYouNote = 'Thank you for your order! Please find your invoice attached.',
  printAreaRef,
  disableEditing = false,
  tagPrintOrderLabel = null,
  tagBrandName = null,
  tagCustomerName = null,
  issuedShareAdvanced = null,
}: InvoiceBuilderProps) {
  const isSubscriptionOnly = orderMode === 'SUBSCRIPTION_ONLY';
  const canSaveSubscriptionOnly = !isSubscriptionOnly || subscriptionOnlyCanSave;
  const showTaxAndDiscount = !isSubscriptionOnly || showTaxAndDiscountWhenNewSubscription;
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newUnitPrice, setNewUnitPrice] = useState(0);
  const [newType, setNewType] = useState<InvoiceItemType>('SERVICE');
  const [catalogService, setCatalogService] = useState<ServiceType>('WASH_FOLD');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [matrixItemId, setMatrixItemId] = useState('');
  const [matrixSegmentId, setMatrixSegmentId] = useState('');
  const [matrixServiceId, setMatrixServiceId] = useState('');
  const [matrixQty, setMatrixQty] = useState(1);
  const [addItemsDialogOpen, setAddItemsDialogOpen] = useState(false);
  /** While editing line qty, hold raw string so decimals like "2." work; commit on blur. */
  const [qtyDraftByRowIndex, setQtyDraftByRowIndex] = useState<Record<number, string>>({});
  const [tagDialogRowIndex, setTagDialogRowIndex] = useState<number | null>(null);
  /** Draft strings so Tax % and Discount can be cleared and retyped; commit on blur. */
  const [taxPercentDraft, setTaxPercentDraft] = useState<string | null>(null);
  const [discountValueDraft, setDiscountValueDraft] = useState<string | null>(null);

  useEffect(() => {
    setDiscountValueDraft(null);
  }, [discountType]);

  const catalogItemsForService =
    catalog?.filter(
      (item) =>
        item.prices?.some((p) => p.serviceType === catalogService && p.active !== false)
    ) ?? [];
  const selectedCatalogItem = catalog?.find((i) => i.id === catalogItemId);
  const selectedPrice = selectedCatalogItem?.prices?.find(
    (p) => p.serviceType === catalogService && p.active !== false
  );

  /** Use Item → Segment → Service cascading whenever catalog matrix has items (segments/services may be empty until admin adds them). */
  const useMatrix = Boolean(catalogMatrix?.items?.length);

  /** Segments that have at least one price for the given item (cascading: Item → Segment). */
  function getSegmentsForItem(itemId: string): { id: string; label: string }[] {
    if (!catalogMatrix) return [];
    const item = catalogMatrix.items.find((i) => i.id === itemId);
    if (!item?.segmentPrices?.length) return [];
    const segmentIds = [...new Set(item.segmentPrices.filter((p) => p.isActive).map((p) => p.segmentCategoryId))];
    return segmentIds
      .map((id) => {
        const seg = catalogMatrix!.segmentCategories.find((s) => s.id === id && s.isActive);
        return seg ? { id: seg.id, label: seg.label } : null;
      })
      .filter((x): x is { id: string; label: string } => x != null);
  }

  /** Services that have a price for the given item + segment (cascading: Item + Segment → Service). */
  function getServicesForItemAndSegment(itemId: string, segmentId: string): { id: string; label: string }[] {
    if (!catalogMatrix || !segmentId) return [];
    const item = catalogMatrix.items.find((i) => i.id === itemId);
    if (!item?.segmentPrices?.length) return [];
    const serviceIds = [
      ...new Set(
        item.segmentPrices
          .filter((p) => p.isActive && p.segmentCategoryId === segmentId)
          .map((p) => p.serviceCategoryId)
      ),
    ];
    return serviceIds
      .map((id) => {
        const svc = catalogMatrix!.serviceCategories.find((s) => s.id === id && s.isActive);
        return svc ? { id: svc.id, label: svc.label } : null;
      })
      .filter((x): x is { id: string; label: string } => x != null);
  }

  const matrixItem = useMatrix ? catalogMatrix!.items.find((i) => i.id === matrixItemId) : null;
  const matrixSegmentsForItem = matrixItemId ? getSegmentsForItem(matrixItemId) : [];
  const matrixServicesForItemSegment =
    matrixItemId && matrixSegmentId ? getServicesForItemAndSegment(matrixItemId, matrixSegmentId) : [];
  const matrixPriceRow = matrixItem?.segmentPrices?.find(
    (p) => p.segmentCategoryId === matrixSegmentId && p.serviceCategoryId === matrixServiceId && p.isActive
  );
  const matrixPricePaise = matrixPriceRow ? Math.round(matrixPriceRow.priceRupees * 100) : 0;

  const lineTagPayload: PrintLineTagPayload | null = useMemo(() => {
    if (tagDialogRowIndex == null || !tagPrintOrderLabel?.trim()) return null;
    const row = items[tagDialogRowIndex];
    if (!row) return null;
    let segment = '—';
    let service = '—';
    if (useMatrix && catalogMatrix && row.catalogItemId && row.segmentCategoryId && row.serviceCategoryId) {
      segment =
        catalogMatrix.segmentCategories.find((s) => s.id === row.segmentCategoryId)?.label ??
        row.segmentCategoryId;
      service =
        catalogMatrix.serviceCategories.find((s) => s.id === row.serviceCategoryId)?.label ??
        row.serviceCategoryId;
    }
    const defaultCopies = Math.ceil(Number(row.quantity) || 1);
    const brand = tagBrandName?.trim() ?? '';
    return {
      brandName: brand,
      customerName: (tagCustomerName ?? '—').trim() || '—',
      orderNumber: tagPrintOrderLabel.trim(),
      itemName: row.name ?? '—',
      segment,
      service,
      defaultCopies: Math.max(1, Math.min(999, defaultCopies)),
    };
  }, [tagDialogRowIndex, items, tagPrintOrderLabel, tagBrandName, tagCustomerName, catalogMatrix, useMatrix]);

  useEffect(() => {
    if (tagDialogRowIndex != null && (tagDialogRowIndex < 0 || tagDialogRowIndex >= items.length)) {
      setTagDialogRowIndex(null);
    }
  }, [tagDialogRowIndex, items.length]);

  useEffect(() => {
    if (selectedPrice != null) setNewUnitPrice(selectedPrice.unitPricePaise);
  }, [catalogItemId, catalogService, selectedPrice?.unitPricePaise]);

  const itemsSubtotal = items.reduce((sum, i) => sum + (i.amountPaise ?? i.quantity * i.unitPricePaise), 0);
  const subtotal = isSubscriptionOnly
    ? (subscriptionAmountPaise ?? 0)
    : itemsSubtotal + (subscriptionAmountPaise ?? 0);
  const discountFromInput = discountAsPercentOrAmount
    ? (discountType === 'percent' ? Math.round(subtotal * (discountValue ?? 0) / 100) : (discountValue ?? 0))
    : 0;
  const discountPaiseEffective = discountAsPercentOrAmount ? discountFromInput : discountPaise;
  /** Tax % applies to amount after discount (taxable base), not gross subtotal. */
  const taxableBasePaise = Math.max(0, subtotal - discountPaiseEffective);
  const taxFromPercent =
    taxAsPercent && onTaxPercentChange != null
      ? Math.round(taxableBasePaise * (taxPercent ?? 0) / 100)
      : 0;
  const taxPaiseEffective = taxAsPercent ? taxFromPercent : taxPaise;
  const total = subtotal - discountPaiseEffective + taxPaiseEffective;

  function addLineFromMatrix() {
    if (!matrixItem || !matrixSegmentId || !matrixServiceId) return;
    const name = matrixItem.name;
    const qty = Math.max(1, matrixQty);
    const unit = matrixPricePaise;
    const amount = Math.round(qty * unit);
    onItemsChange([
      ...items,
      {
        type: 'DRYCLEAN_ITEM',
        name,
        quantity: qty,
        unitPricePaise: unit,
        amountPaise: amount,
        catalogItemId: matrixItem.id,
        segmentCategoryId: matrixSegmentId,
        serviceCategoryId: matrixServiceId,
      },
    ]);
    setMatrixQty(1);
  }

  function addLine() {
    if (useMatrix) {
      addLineFromMatrix();
      return;
    }
    const name =
      catalog && selectedCatalogItem ? selectedCatalogItem.name : newName.trim();
    const qty = newQty;
    const unit = newUnitPrice;
    if (!name.trim()) return;
    const lineType =
      catalog?.length && catalogService === 'DRY_CLEAN'
        ? 'DRYCLEAN_ITEM'
        : catalog?.length && catalogService === 'ADD_ONS'
          ? 'ADDON'
          : newType;
    const amount = lineType === 'DISCOUNT' ? -Math.round(qty * unit) : Math.round(qty * unit);
    onItemsChange([
      ...items,
      {
        type: lineType,
        name: name.trim(),
        quantity: qty,
        unitPricePaise: unit,
        amountPaise: amount,
      },
    ]);
    setNewName('');
    setNewQty(1);
    setNewUnitPrice(0);
    setCatalogItemId('');
  }

  function removeLine(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function getMatrixPriceForRow(row: InvoiceLineRow): number | null {
    if (!catalogMatrix || !row.catalogItemId || !row.segmentCategoryId || !row.serviceCategoryId) return null;
    const it = catalogMatrix.items.find((i) => i.id === row.catalogItemId);
    const pr = it?.segmentPrices?.find(
      (p) => p.segmentCategoryId === row.segmentCategoryId && p.serviceCategoryId === row.serviceCategoryId && p.isActive
    );
    return pr ? Math.round(pr.priceRupees * 100) : null;
  }

  function updateLine(index: number, patch: Partial<InvoiceLineRow>) {
    const row = items[index];
    if (!row) return;
    const updated: InvoiceLineRow = {
      ...row,
      ...patch,
      quantity: patch.quantity ?? row.quantity,
      unitPricePaise: patch.unitPricePaise ?? row.unitPricePaise,
    };
    if (useMatrix && updated.catalogItemId && updated.segmentCategoryId && updated.serviceCategoryId) {
      const unit = getMatrixPriceForRow(updated);
      if (unit != null) {
        updated.unitPricePaise = unit;
        const item = catalogMatrix!.items.find((i) => i.id === updated.catalogItemId);
        if (item) updated.name = item.name;
      }
    }
    const amount =
      updated.type === 'DISCOUNT'
        ? -Math.round(updated.quantity * updated.unitPricePaise)
        : Math.round(updated.quantity * updated.unitPricePaise);
    const next = items.map((r, i) =>
      i === index ? { ...updated, amountPaise: amount } : r
    );
    onItemsChange(next);
  }

  const allowMutation = !issued && !disableEditing;
  const useCatalog = Boolean(catalog?.length) && !useMatrix;

  const hasSubscriptionLines = (subscriptionLines?.length ?? 0) > 0;
  const showItemsTable = !isSubscriptionOnly || hasSubscriptionLines;

  const [shareLoading, setShareLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  async function handleDownloadPdf() {
    const element = printAreaRef?.current;
    if (element) {
      setDownloadLoading(true);
      try {
        element.classList.add('pdf-capture');
        await new Promise((r) => setTimeout(r, 150));
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf()
          .set({
            margin: 10,
            filename: 'invoice.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(element)
          .save();
      } catch (_) {
        if (pdfUrl) {
          const fullPdfUrl = pdfUrl.startsWith('http') ? pdfUrl : `${getApiOrigin()}${pdfUrl}`;
          const token = getToken();
          const res = await fetch(fullPdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'invoice.pdf';
            a.click();
            URL.revokeObjectURL(url);
          } else {
            window.open(fullPdfUrl, '_blank');
          }
        }
      } finally {
        element.classList.remove('pdf-capture');
        setDownloadLoading(false);
      }
      return;
    }
    if (!pdfUrl) return;
    const fullPdfUrl = pdfUrl.startsWith('http') ? pdfUrl : `${getApiOrigin()}${pdfUrl}`;
    setDownloadLoading(true);
    try {
      const token = getToken();
      const res = await fetch(fullPdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Failed to fetch PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      window.open(fullPdfUrl, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }
  async function handleShareOnWhatsApp() {
    if (!whatsappShareMessage) return;
    const fullPdfUrl = pdfUrl ? (pdfUrl.startsWith('http') ? pdfUrl : `${getApiOrigin()}${pdfUrl}`) : null;
    const thankYouNote = whatsappShareThankYouNote?.trim() || 'Thank you for your order! Please find your invoice attached.';
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
      /* User cancelled or share not supported; fall back to wa.me */
    } finally {
      setShareLoading(false);
    }
    const textForWa = fullPdfUrl ? `${thankYouNote}\n\n${fullPdfUrl}` : whatsappShareMessage;
    window.open(`https://wa.me/?text=${encodeURIComponent(textForWa)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      {showItemsTable && (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {useMatrix ? (
                <>
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Segment</th>
                  <th className="text-left py-2">Service</th>
                </>
              ) : (
                <>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Name</th>
                </>
              )}
              <th className="text-right py-2">Qty</th>
              {useMatrix ? (
                <>
                  <th className="text-right py-2">Service cost (₹)</th>
                  <th className="text-right py-2">Total cost (₹)</th>
                </>
              ) : (
                <>
                  <th className="text-right py-2">Unit (₹)</th>
                  <th className="text-right py-2">Amount (₹)</th>
                </>
              )}
              {(allowMutation || tagPrintOrderLabel) && (
                <th className="text-right py-2 w-[1%] whitespace-nowrap">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !hasSubscriptionLines ? (
              <tr className="border-b">
                <td
                  colSpan={(useMatrix ? 6 : 5) + (allowMutation || tagPrintOrderLabel ? 1 : 0)}
                  className="py-3 text-center text-muted-foreground"
                >
                  NA
                </td>
              </tr>
            ) : (
            <>
            {items.map((row, i) => {
              const isMatrixRow = useMatrix && row.catalogItemId && catalogMatrix;
              const qtyMin =
                subscriptionUsageRowIndex === i && subscriptionUnit
                  ? 0
                  : isMatrixRow
                    ? 0.1
                    : 1;
              const rowSegments = isMatrixRow && row.catalogItemId ? getSegmentsForItem(row.catalogItemId) : [];
              const rowServices =
                isMatrixRow && row.catalogItemId && row.segmentCategoryId
                  ? getServicesForItemAndSegment(row.catalogItemId, row.segmentCategoryId)
                  : [];
              return (
                <tr key={i} className="border-b">
                  {useMatrix ? (
                    isMatrixRow && catalogMatrix ? (
                      <>
                        <td className="align-middle py-2">
                          {allowMutation ? (
                            <Select
                              value={row.catalogItemId}
                              onValueChange={(newItemId) => {
                                const it = catalogMatrix.items.find((x) => x.id === newItemId);
                                const segs = getSegmentsForItem(newItemId);
                                const svcsForCurrentSeg =
                                  row.segmentCategoryId && getServicesForItemAndSegment(newItemId, row.segmentCategoryId);
                                const keepCurrent =
                                  row.segmentCategoryId &&
                                  row.serviceCategoryId &&
                                  Array.isArray(svcsForCurrentSeg) &&
                                  svcsForCurrentSeg.some((s) => s.id === row.serviceCategoryId);
                                const segmentId = keepCurrent ? row.segmentCategoryId : segs[0]?.id ?? '';
                                const svcs = getServicesForItemAndSegment(newItemId, segmentId ?? '');
                                const serviceId =
                                  keepCurrent && segmentId === row.segmentCategoryId ? row.serviceCategoryId! : svcs[0]?.id ?? '';
                                updateLine(i, {
                                  catalogItemId: newItemId,
                                  name: it?.name ?? row.name,
                                  segmentCategoryId: segmentId,
                                  serviceCategoryId: serviceId,
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 w-full max-w-[160px] [&>span]:!flex [&>span]:!flex-row [&>span]:!items-center">
                                <span className="flex flex-row items-center gap-2 min-h-0 min-w-0 flex-1 overflow-hidden">
                                  {(() => {
                                    const it = catalogMatrix.items.find((x) => x.id === row.catalogItemId);
                                    return it ? (
                                      <>
                                        <span className="flex shrink-0 items-center justify-center">
                                          <CatalogItemIcon icon={it.icon} size={18} className="shrink-0" cacheBuster={it.updatedAt} />
                                        </span>
                                        <span className="min-w-0 truncate text-left">
                                          <SelectValue className="truncate">{it.name}</SelectValue>
                                        </span>
                                      </>
                                    ) : (
                                      <SelectValue placeholder="Item" />
                                    );
                                  })()}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {catalogMatrix.items.filter((x) => x.active).map((x) => (
                                  <SelectItem key={x.id} value={x.id}>
                                    <span className="flex items-center gap-2">
                                      <span className="flex shrink-0 items-center">
                                        <CatalogItemIcon icon={x.icon} size={18} className="shrink-0 inline-block align-middle" cacheBuster={x.updatedAt} />
                                      </span>
                                      <span className="truncate">{x.name}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            (() => {
                              const it = row.catalogItemId && catalogMatrix
                                ? catalogMatrix.items.find((x) => x.id === row.catalogItemId)
                                : null;
                              return it ? (
                                <span className="flex min-h-[24px] w-full items-center gap-2.5">
                                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center [&_svg]:block">
                                    <CatalogItemIcon icon={it.icon} size={18} className="shrink-0" cacheBuster={it.updatedAt} />
                                  </span>
                                  <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-sm leading-6">
                                    {row.name}
                                  </span>
                                </span>
                              ) : (
                                row.name
                              );
                            })()
                          )}
                        </td>
                        <td className="align-middle py-2">
                          {allowMutation ? (
                            <select
                              className="h-8 w-full max-w-[120px] rounded border pl-2 pr-6 text-sm"
                              value={row.segmentCategoryId}
                              onChange={(e) => {
                                const newSegId = e.target.value;
                                const svcs = getServicesForItemAndSegment(row.catalogItemId!, newSegId);
                                const firstSvcId = svcs[0]?.id ?? '';
                                updateLine(i, {
                                  segmentCategoryId: newSegId,
                                  serviceCategoryId: firstSvcId,
                                });
                              }}
                            >
                              {rowSegments.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            catalogMatrix.segmentCategories.find((s) => s.id === row.segmentCategoryId)?.label ?? row.segmentCategoryId
                          )}
                        </td>
                        <td className="align-middle py-2">
                          {allowMutation ? (
                            <select
                              className="h-8 w-full max-w-[120px] rounded border pl-2 pr-6 text-sm"
                              value={row.serviceCategoryId}
                              onChange={(e) => updateLine(i, { serviceCategoryId: e.target.value })}
                            >
                              {rowServices.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            catalogMatrix.serviceCategories.find((s) => s.id === row.serviceCategoryId)?.label ?? row.serviceCategoryId
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td colSpan={3} className="py-1 text-muted-foreground">{row.name}</td>
                      </>
                    )
                  ) : (
                    <>
                      <td className="py-1">
                        {allowMutation ? (
                          <select
                            className="h-8 w-full max-w-[120px] rounded border pl-2 pr-6 text-sm"
                            value={row.type}
                            onChange={(e) => updateLine(i, { type: e.target.value as InvoiceItemType })}
                          >
                            {ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        ) : (
                          row.type
                        )}
                      </td>
                      <td className="py-1">
                        {allowMutation ? (
                          <Input
                            className="h-8 min-w-0 max-w-[180px]"
                            value={row.name}
                            onChange={(e) => updateLine(i, { name: e.target.value })}
                          />
                        ) : (
                          row.name
                        )}
                      </td>
                    </>
                  )}
                  <td className="align-middle py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {allowMutation ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          className="h-8 w-[4.25rem] text-right tabular-nums"
                          value={
                            qtyDraftByRowIndex[i] !== undefined
                              ? qtyDraftByRowIndex[i]
                              : String(row.quantity)
                          }
                          onFocus={() => {
                            setQtyDraftByRowIndex((p) => ({
                              ...p,
                              [i]: p[i] ?? String(row.quantity),
                            }));
                          }}
                          onChange={(e) => {
                            let v = e.target.value.replace(',', '.');
                            if (v === '' || /^\d*\.?\d*$/.test(v)) {
                              setQtyDraftByRowIndex((p) => ({ ...p, [i]: v }));
                            }
                          }}
                          onBlur={(e) => {
                            const rawDraft = e.target.value.replace(',', '.').trim();
                            setQtyDraftByRowIndex((p) => {
                              const next = { ...p };
                              delete next[i];
                              return next;
                            });
                            let q = row.quantity;
                            if (rawDraft !== '' && rawDraft !== '.') {
                              const n = Number(rawDraft);
                              if (Number.isFinite(n)) q = Math.max(qtyMin, n);
                            } else {
                              q = Math.max(qtyMin, row.quantity);
                            }
                            updateLine(i, { quantity: q });
                          }}
                        />
                      ) : (
                        row.quantity
                      )}
                      {subscriptionUnit != null && subscriptionUsageRowIndex === i && (
                        <span className="text-muted-foreground text-sm whitespace-nowrap">{subscriptionUnit}</span>
                      )}
                    </span>
                  </td>
                  <td className="align-middle py-2 text-right">
                    {formatMoney(row.unitPricePaise)}
                  </td>
                  <td className="align-middle py-2 text-right">
                    {formatMoney(row.amountPaise ?? row.quantity * row.unitPricePaise)}
                  </td>
                  {(allowMutation || tagPrintOrderLabel) && (
                    <td className="align-middle py-2">
                      <div className="flex flex-nowrap items-center justify-end gap-0.5">
                        {tagPrintOrderLabel && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Print tag"
                            aria-label="Print tag"
                            onClick={() => setTagDialogRowIndex(i)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {allowMutation && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            title="Remove line"
                            aria-label="Remove line"
                            onClick={() => removeLine(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {subscriptionLines?.map((sub, idx) => {
              const amount = sub.quantity * sub.unitPricePaise;
              return (
                <tr key={`sub-${idx}`} className="border-b bg-muted/20">
                  {useMatrix ? (
                    <>
                      <td className="py-1">Subscription – {sub.planName}</td>
                      <td className="py-1 text-muted-foreground">{sub.startDate}</td>
                      <td className="py-1">—</td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 text-muted-foreground">Subscription</td>
                      <td className="py-1">{sub.planName}</td>
                    </>
                  )}
                  <td className="text-right py-1">{sub.quantity}</td>
                  <td className="text-right py-1">{formatMoney(sub.unitPricePaise)}</td>
                  <td className="text-right py-1">{formatMoney(amount)}</td>
                  {(allowMutation || tagPrintOrderLabel) && <td className="py-1" />}
                </tr>
              );
            })}
            </>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!issued && !isSubscriptionOnly && (
        <div className="w-full space-y-2">
          {useMatrix && catalogMatrix ? (
            <>
              <Button
                type="button"
                variant="default"
                className="w-full"
                disabled={!allowMutation}
                onClick={() => setAddItemsDialogOpen(true)}
              >
                Add items
              </Button>
              <AddItemsToInvoiceDialog
                open={addItemsDialogOpen}
                onOpenChange={setAddItemsDialogOpen}
                catalogMatrix={catalogMatrix}
                onAddLine={(line) => {
                  onItemsChange([...items, line]);
                }}
              />
            </>
          ) : useCatalog ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Service</label>
                  <select
                    className="h-9 rounded-md border px-2 text-sm"
                    value={catalogService}
                    disabled={!allowMutation}
                    onChange={(e) => {
                      setCatalogService(e.target.value as ServiceType);
                      setCatalogItemId('');
                    }}
                  >
                    {SERVICE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Item</label>
                  <select
                    className="h-9 min-w-[140px] rounded-md border px-2 text-sm"
                    value={catalogItemId}
                    disabled={!allowMutation}
                    onChange={(e) => setCatalogItemId(e.target.value)}
                  >
                    <option value="">Select item</option>
                    {catalogItemsForService.map((item) => {
                      const price = item.prices?.find(
                        (p) => p.serviceType === catalogService && p.active !== false
                      );
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} – {price ? formatMoney(price.unitPricePaise) : '—'} / unit
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={newQty}
                    disabled={!allowMutation}
                    onChange={(e) => setNewQty(Number(e.target.value) || 1)}
                    className="w-20 h-9"
                    placeholder="Qty"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={addLine}
                disabled={!catalogItemId || !allowMutation}
              >
                Add line
              </Button>
            </>
          ) : (
            <>
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={newType}
                disabled={!allowMutation}
                onChange={(e) => setNewType(e.target.value as InvoiceItemType)}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Input
                placeholder="Item name"
                value={newName}
                readOnly={!allowMutation}
                onChange={(e) => setNewName(e.target.value)}
                className="w-40"
              />
              <Input
                type="number"
                min={1}
                value={newQty}
                disabled={!allowMutation}
                onChange={(e) => setNewQty(Number(e.target.value) || 1)}
                className="w-20"
              />
              <Input
                type="number"
                min={0}
                placeholder="Unit price (paise)"
                value={newUnitPrice || ''}
                disabled={!allowMutation}
                onChange={(e) => setNewUnitPrice(Number(e.target.value) || 0)}
                className="w-28"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                disabled={!newName.trim() || !allowMutation}
              >
                Add line
              </Button>
            </>
          )}
        </div>
      )}

      {showTaxAndDiscount && !issued && (
        <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {discountAsPercentOrAmount && onDiscountTypeChange != null && onDiscountValueChange != null ? (
              <>
                <div className="space-y-1 ack-print-hide">
                  <label className="text-xs text-muted-foreground">Discount type</label>
                  <select
                    className="h-9 rounded-md border px-2 text-sm"
                    value={discountType}
                    disabled={!allowMutation}
                    onChange={(e) => onDiscountTypeChange(e.target.value as 'percent' | 'amount')}
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="amount">Amount (₹)</option>
                  </select>
                </div>
                <div className="space-y-1 ack-print-hide">
                  <label className="text-xs text-muted-foreground">{discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={
                      discountValueDraft !== null
                        ? discountValueDraft
                        : discountType === 'percent'
                          ? String(discountValue ?? 0)
                          : String((discountValue ?? 0) / 100)
                    }
                    disabled={!allowMutation}
                    onFocus={() => {
                      setDiscountValueDraft(
                        discountType === 'percent'
                          ? String(discountValue ?? 0)
                          : String((discountValue ?? 0) / 100)
                      );
                    }}
                    onChange={(e) => {
                      let v = e.target.value.replace(',', '.');
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setDiscountValueDraft(v);
                      }
                    }}
                    onBlur={() => {
                      const fallback =
                        discountType === 'percent'
                          ? String(discountValue ?? 0)
                          : String((discountValue ?? 0) / 100);
                      const raw = (discountValueDraft ?? fallback).replace(',', '.').trim();
                      setDiscountValueDraft(null);
                      if (raw === '' || raw === '.') {
                        onDiscountValueChange(0);
                        return;
                      }
                      const n = parseFloat(raw);
                      if (!Number.isFinite(n)) {
                        return;
                      }
                      if (discountType === 'percent') {
                        onDiscountValueChange(Math.min(100, Math.max(0, n)));
                      } else {
                        onDiscountValueChange(Math.max(0, Math.round(n * 100)));
                      }
                    }}
                    className="w-28"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1 ack-print-hide">
                <label className="text-xs text-muted-foreground">Discount (paise)</label>
                <Input
                  type="number"
                  min={0}
                  value={discountPaise}
                  disabled={!allowMutation}
                  onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
                  className="w-28"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {taxAsPercent && onTaxPercentChange != null ? (
              <div className="space-y-1 ack-print-hide">
                <label className="text-xs text-muted-foreground">Tax (%)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={taxPercentDraft !== null ? taxPercentDraft : String(taxPercent ?? 0)}
                  disabled={!allowMutation}
                  onFocus={() => {
                    setTaxPercentDraft(String(taxPercent ?? 0));
                  }}
                  onChange={(e) => {
                    let v = e.target.value.replace(',', '.');
                    if (v === '' || /^\d*\.?\d*$/.test(v)) {
                      setTaxPercentDraft(v);
                    }
                  }}
                  onBlur={() => {
                    const raw = (taxPercentDraft ?? String(taxPercent ?? 0)).replace(',', '.').trim();
                    setTaxPercentDraft(null);
                    if (raw === '' || raw === '.') {
                      onTaxPercentChange(0);
                      return;
                    }
                    const n = parseFloat(raw);
                    if (!Number.isFinite(n)) {
                      onTaxPercentChange(taxPercent ?? 0);
                      return;
                    }
                    onTaxPercentChange(Math.min(100, Math.max(0, n)));
                  }}
                  className="w-24"
                />
              </div>
            ) : (
              <div className="space-y-1 ack-print-hide">
                <label className="text-xs text-muted-foreground">Tax (paise)</label>
                <Input
                  type="number"
                  min={0}
                  value={taxPaise}
                  disabled={!allowMutation}
                  onChange={(e) => onTaxChange(Number(e.target.value) || 0)}
                  className="w-28"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {onCommentsChange != null && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground ack-print-hide">Comments (included in invoice)</label>
          <textarea
            className={cn(
              'min-h-[60px] w-full rounded-md border px-3 py-2 text-sm ack-comments-input',
              !allowMutation && 'cursor-not-allowed bg-muted/50 text-muted-foreground',
            )}
            value={comments}
            readOnly={!allowMutation}
            disabled={!allowMutation}
            onChange={(e) => {
              if (!allowMutation) return;
              onCommentsChange(e.target.value);
            }}
            placeholder="Thank you"
          />
        </div>
      )}

      <div className="flex gap-2">
        {allowMutation && (
          <>
            {!hideSaveDraftButton && (
              <Button
                variant="secondary"
                onClick={onSaveDraft}
                disabled={saveDraftLoading || (canSaveDraft !== true && (!canSaveSubscriptionOnly || (!isSubscriptionOnly && items.length === 0)))}
              >
                {saveDraftLoading ? 'Saving…' : (saveDraftLabel ?? 'Save draft')}
              </Button>
            )}
            <Button
              onClick={onIssue}
              disabled={issueLoading || (!draftExists && !allowSubmitWithoutDraft) || issueDisabled}
            >
              {issueLoading ? 'Submitting…' : 'Submit'}
            </Button>
          </>
        )}
        {issued &&
        showPrintOnly &&
        (pdfUrl || printAreaRef) &&
        issuedShareAdvanced &&
        printAreaRef ? (
          <IssuedInvoiceShareToolbar printRef={printAreaRef} pdfUrl={pdfUrl} config={issuedShareAdvanced} />
        ) : (
          <>
            {issued && (pdfUrl || printAreaRef) && (
              <Button
                variant="default"
                className="ack-print-hide"
                onClick={handleDownloadPdf}
                disabled={downloadLoading}
              >
                {downloadLoading ? 'Downloading…' : 'Download PDF'}
              </Button>
            )}
            {issued && showPrintOnly && onPrint && (
              <Button variant="outline" className="ack-print-hide" onClick={onPrint}>
                Print
              </Button>
            )}
            {issued && whatsappShareMessage && (
              <Button
                variant="default"
                className="ack-print-hide"
                onClick={handleShareOnWhatsApp}
                disabled={shareLoading}
              >
                {shareLoading ? 'Sharing…' : 'Share on WhatsApp'}
              </Button>
            )}
          </>
        )}
        {issued && !showPrintOnly && pdfUrl && (
          <a
            href={pdfUrl.startsWith('http') ? pdfUrl : `${getApiOrigin()}${pdfUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">Open PDF</Button>
          </a>
        )}
      </div>

      {issued && !showPrintOnly && pdfUrl && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">Preview</p>
          <iframe
            title="Invoice PDF"
            src={pdfUrl.startsWith('http') ? pdfUrl : `${getApiOrigin()}${pdfUrl}`}
            className="w-full h-[400px] border rounded"
          />
        </div>
      )}

      <PrintLineTagDialog
        open={tagDialogRowIndex !== null && lineTagPayload !== null}
        onOpenChange={(o) => {
          if (!o) setTagDialogRowIndex(null);
        }}
        payload={lineTagPayload}
      />
    </div>
  );
}
