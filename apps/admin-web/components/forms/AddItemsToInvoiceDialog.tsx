'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CatalogItemIcon } from '@/components/catalog/CatalogItemIcon';
import type { CatalogMatrixResponse } from '@/types/catalog';
import type { InvoiceLineRow } from './InvoiceBuilder';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Pencil, RotateCcw, Search } from 'lucide-react';

function getSegmentsForItem(catalogMatrix: CatalogMatrixResponse, itemId: string): { id: string; label: string }[] {
  const item = catalogMatrix.items.find((i) => i.id === itemId);
  if (!item?.segmentPrices?.length) return [];
  const segmentIds = [...new Set(item.segmentPrices.filter((p) => p.isActive).map((p) => p.segmentCategoryId))];
  return segmentIds
    .map((id) => {
      const seg = catalogMatrix.segmentCategories.find((s) => s.id === id && s.isActive);
      return seg ? { id: seg.id, label: seg.label } : null;
    })
    .filter((x): x is { id: string; label: string } => x != null);
}

function getServicesForItemAndSegment(
  catalogMatrix: CatalogMatrixResponse,
  itemId: string,
  segmentId: string
): { id: string; label: string }[] {
  const item = catalogMatrix.items.find((i) => i.id === itemId);
  if (!item?.segmentPrices?.length || !segmentId) return [];
  const serviceIds = [
    ...new Set(
      item.segmentPrices
        .filter((p) => p.isActive && p.segmentCategoryId === segmentId)
        .map((p) => p.serviceCategoryId)
    ),
  ];
  return serviceIds
    .map((id) => {
      const svc = catalogMatrix.serviceCategories.find((s) => s.id === id && s.isActive);
      return svc ? { id: svc.id, label: svc.label } : null;
    })
    .filter((x): x is { id: string; label: string } => x != null);
}

function getPricePaise(
  catalogMatrix: CatalogMatrixResponse,
  itemId: string,
  segmentId: string,
  serviceId: string
): number | null {
  const item = catalogMatrix.items.find((i) => i.id === itemId);
  const row = item?.segmentPrices?.find(
    (p) =>
      p.segmentCategoryId === segmentId &&
      p.serviceCategoryId === serviceId &&
      p.isActive
  );
  return row ? Math.round(row.priceRupees * 100) : null;
}

interface AddItemsToInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogMatrix: CatalogMatrixResponse;
  onAddLine: (line: InvoiceLineRow) => void;
  /** Branch primary (hex); drives borders, text, chevron, CTA. */
  primaryColor?: string | null;
  /** Branch secondary (hex); drives field backgrounds. */
  secondaryColor?: string | null;
}

const DEFAULT_PRIMARY = '#1e3a8a';
const DEFAULT_SECONDARY = '#dbeafe';

function normalizeHex(raw: string | null | undefined, fallback: string): string {
  if (raw == null || !String(raw).trim()) return fallback;
  let h = String(raw).trim();
  if (!h.startsWith('#')) h = `#${h}`;
  const core = h.slice(1);
  if (core.length === 8) return `#${core.slice(0, 6)}`;
  if (core.length === 3) {
    return `#${core.split('').map((c) => c + c).join('')}`;
  }
  return core.length === 6 ? h : fallback;
}

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
}

function relLuminance(hex: string): number {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function onPrimaryFor(bg: string): string {
  return relLuminance(bg) > 0.55 ? '#111827' : '#ffffff';
}

const MIN_INVOICE_ITEM_QTY = 0.1;

/** Parse draft string; returns null if empty/invalid or below minimum (button stays disabled). */
function parseValidInvoiceQty(draft: string): number | null {
  const t = draft.trim().replace(',', '.');
  if (t === '' || t === '.') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < MIN_INVOICE_ITEM_QTY) return null;
  return n;
}

function qtyToDraftString(q: number): string {
  if (!Number.isFinite(q) || q < MIN_INVOICE_ITEM_QTY) return '1';
  const rounded = Math.round(q * 1e6) / 1e6;
  return String(rounded);
}

function parseRupeesDraftToPaise(draft: string): number | null {
  const t = draft.trim().replace(',', '.');
  if (t === '' || t === '.') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function paiseToRupeesDraft(paise: number): string {
  if (!Number.isFinite(paise) || paise < 0) return '0';
  return String(Math.round(paise) / 100);
}

const REMARKS_MAX = 500;

export function AddItemsToInvoiceDialog({
  open,
  onOpenChange,
  catalogMatrix,
  onAddLine,
  primaryColor: primaryColorProp,
  secondaryColor: secondaryColorProp,
}: AddItemsToInvoiceDialogProps) {
  const primary = useMemo(
    () => normalizeHex(primaryColorProp, DEFAULT_PRIMARY),
    [primaryColorProp],
  );
  const secondary = useMemo(
    () => normalizeHex(secondaryColorProp, DEFAULT_SECONDARY),
    [secondaryColorProp],
  );

  const qtyWrapBorder = `color-mix(in srgb, ${primary} 36%, rgb(229, 231, 235))`;
  const qtyWrapBg = `color-mix(in srgb, ${secondary} 48%, rgb(255, 255, 255))`;
  const qtyInputColor = `color-mix(in srgb, ${primary} 78%, rgb(17, 24, 39))`;

  const selectStyle = useMemo(() => {
    const enc = encodeURIComponent(primary);
    const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${enc}' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
    return {
      backgroundImage: chevron,
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      borderColor: `color-mix(in srgb, ${primary} 40%, rgb(229, 231, 235))`,
      color: `color-mix(in srgb, ${primary} 80%, rgb(17, 24, 39))`,
      backgroundColor: `color-mix(in srgb, ${secondary} 52%, rgb(255, 255, 255))`,
    } as React.CSSProperties;
  }, [primary, secondary]);

  const [configItemId, setConfigItemId] = useState<string | null>(null);
  const [segmentByItem, setSegmentByItem] = useState<Record<string, string>>({});
  const [serviceByItem, setServiceByItem] = useState<Record<string, string>>({});
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [configQtyDraft, setConfigQtyDraft] = useState('1');
  const [configRemarksDraft, setConfigRemarksDraft] = useState('');
  const [configUnitPriceDraft, setConfigUnitPriceDraft] = useState('');
  const [isServiceCostEditable, setIsServiceCostEditable] = useState(false);

  useEffect(() => {
    if (!open) setItemSearch('');
  }, [open]);

  useEffect(() => {
    if (!configItemId) setConfigRemarksDraft('');
  }, [configItemId]);

  useEffect(() => {
    if (!configItemId) return;
    const stored = qtyByItem[configItemId];
    setConfigQtyDraft(stored != null ? qtyToDraftString(stored) : '1');
  }, [configItemId]);

  const activeItems = useMemo(
    () => catalogMatrix.items.filter((i) => i.active),
    [catalogMatrix.items],
  );

  const searchNorm = itemSearch.trim().toLowerCase();
  const gridItems = useMemo(() => {
    if (!searchNorm) return activeItems;
    const segLabels = new Map(
      catalogMatrix.segmentCategories.map((s) => [s.id, (s.label || s.code || '').toLowerCase()]),
    );
    const svcLabels = new Map(
      catalogMatrix.serviceCategories.map((s) => [s.id, (s.label || s.code || '').toLowerCase()]),
    );
    return activeItems.filter((item) => {
      if (item.name.toLowerCase().includes(searchNorm)) return true;
      if (item.id.toLowerCase().includes(searchNorm)) return true;
      for (const line of item.segmentPrices) {
        const seg = segLabels.get(line.segmentCategoryId) ?? '';
        const svc = svcLabels.get(line.serviceCategoryId) ?? '';
        if (seg.includes(searchNorm) || svc.includes(searchNorm)) return true;
      }
      return false;
    });
  }, [activeItems, searchNorm, catalogMatrix.segmentCategories, catalogMatrix.serviceCategories]);
  const configItem = configItemId ? catalogMatrix.items.find((i) => i.id === configItemId) : null;
  const configSegments = configItemId ? getSegmentsForItem(catalogMatrix, configItemId) : [];
  const configSegmentId = configItemId ? (segmentByItem[configItemId] ?? '') : '';
  const configServices = configItemId && configSegmentId
    ? getServicesForItemAndSegment(catalogMatrix, configItemId, configSegmentId)
    : [];
  const configServiceId = configItemId ? (serviceByItem[configItemId] ?? '') : '';
  const configPricePaise = configItemId && configSegmentId && configServiceId
    ? getPricePaise(catalogMatrix, configItemId, configSegmentId, configServiceId)
    : null;
  useEffect(() => {
    setConfigUnitPriceDraft(configPricePaise != null ? paiseToRupeesDraft(configPricePaise) : '');
    setIsServiceCostEditable(false);
  }, [configPricePaise]);
  const parsedConfigQty = useMemo(() => parseValidInvoiceQty(configQtyDraft), [configQtyDraft]);
  const parsedConfigUnitPaise = useMemo(
    () => parseRupeesDraftToPaise(configUnitPriceDraft),
    [configUnitPriceDraft],
  );
  const configTotalPaise =
    parsedConfigUnitPaise != null && parsedConfigQty != null
      ? Math.round(parsedConfigUnitPaise * parsedConfigQty)
      : null;

  const handleAdd = useCallback(
    (itemId: string, qty: number, unitPaise: number, remarks?: string) => {
      const item = catalogMatrix.items.find((i) => i.id === itemId);
      if (!item) return;
      const segmentId = segmentByItem[itemId];
      const serviceId = serviceByItem[itemId];
      if (!segmentId || !serviceId) return;
      const amount = Math.round(qty * unitPaise);
      setQtyByItem((prev) => ({ ...prev, [itemId]: qty }));
      const r = remarks?.trim().slice(0, REMARKS_MAX) ?? '';
      onAddLine({
        type: 'DRYCLEAN_ITEM',
        name: item.name,
        quantity: qty,
        ...(r ? { remarks: r } : {}),
        unitPricePaise: unitPaise,
        amountPaise: amount,
        catalogItemId: itemId,
        segmentCategoryId: segmentId,
        serviceCategoryId: serviceId,
      });
      setConfigItemId(null);
      onOpenChange(false);
    },
    [catalogMatrix, segmentByItem, serviceByItem, onAddLine, onOpenChange],
  );

  const openConfig = (itemId: string) => {
    setConfigRemarksDraft('');
    setConfigItemId(itemId);
    const segs = getSegmentsForItem(catalogMatrix, itemId);
    if (!segmentByItem[itemId] && segs.length) {
      setSegmentByItem((prev) => ({ ...prev, [itemId]: segs[0].id }));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add items to invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Click an item, then choose Segment and Service in the next step.
          </p>
          <div className="relative shrink-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search items by name, segment, or service…"
              className="pl-9"
              aria-label="Search catalog items"
            />
          </div>
          <div className="grid grid-cols-3 gap-4 overflow-y-auto min-h-0 flex-1 py-2">
            {gridItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex flex-col items-center justify-start rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors min-h-[110px]"
                style={{ borderColor: `color-mix(in srgb, ${primary} 22%, rgb(229, 231, 235))` }}
                onClick={() => openConfig(item.id)}
              >
                <span
                  className="flex items-center justify-center w-14 h-14 rounded-lg border mb-1.5 shrink-0"
                  style={{
                    borderColor: `color-mix(in srgb, ${primary} 28%, rgb(229, 231, 235))`,
                    backgroundColor: `color-mix(in srgb, ${secondary} 35%, rgb(249, 250, 251))`,
                  }}
                >
                  <CatalogItemIcon icon={item.icon} size={40} cacheBuster={item.updatedAt} />
                </span>
                <span className="font-semibold text-xs text-center leading-tight line-clamp-2 w-full">{item.name}</span>
              </button>
            ))}
            {activeItems.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">No active catalog items.</p>
            )}
            {activeItems.length > 0 && gridItems.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">No items match your search.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Second popup: Segment, Service, Qty, cost, Add to invoice */}
      <Dialog open={!!configItemId} onOpenChange={(o) => !o && setConfigItemId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{configItem?.name ?? 'Select options'}</DialogTitle>
          </DialogHeader>
          {configItem && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Segment</label>
                <select
                  className="h-10 w-full rounded-md border pl-3 pr-8 py-2 text-sm appearance-none bg-no-repeat dark:bg-background"
                  style={selectStyle}
                  value={configSegmentId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSegmentByItem((prev) => ({ ...prev, [configItemId!]: v }));
                    setServiceByItem((prev) => ({ ...prev, [configItemId!]: '' }));
                    setIsServiceCostEditable(false);
                  }}
                >
                  <option value="">Select segment</option>
                  {configSegments.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Service</label>
                <select
                  className="h-10 w-full rounded-md border pl-3 pr-8 py-2 text-sm appearance-none bg-no-repeat dark:bg-background"
                  style={selectStyle}
                  value={configServiceId}
                  onChange={(e) => {
                    setServiceByItem((prev) => ({ ...prev, [configItemId!]: e.target.value }));
                    setIsServiceCostEditable(false);
                  }}
                  disabled={!configSegmentId}
                >
                  <option value="">Select service</option>
                  {configServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Qty</label>
                  <div
                    className="rounded-md border-2"
                    style={{
                      borderColor: qtyWrapBorder,
                      backgroundColor: qtyWrapBg,
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={configQtyDraft}
                      onChange={(e) => {
                        let v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) {
                          setConfigQtyDraft(v);
                        }
                      }}
                      onBlur={() => {
                        setConfigQtyDraft((prev) => {
                          const t = prev.trim().replace(',', '.');
                          if (t === '') return '1';
                          return prev;
                        });
                      }}
                      placeholder="1"
                      className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none px-3"
                      style={{ color: qtyInputColor }}
                      aria-label="Quantity"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum {MIN_INVOICE_ITEM_QTY}. Decimals allowed (e.g. 0.5 kg).
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Service cost (₹)
                  </label>
                  <div
                    className="relative rounded-md border-2"
                    style={{
                      borderColor: !isServiceCostEditable
                        ? 'rgb(209, 213, 219)'
                        : qtyWrapBorder,
                      backgroundColor: !isServiceCostEditable
                        ? 'rgb(243, 244, 246)'
                        : qtyWrapBg,
                    }}
                  >
                    <Input
                      type="text"
                      inputMode={isServiceCostEditable ? 'decimal' : undefined}
                      autoComplete="off"
                      value={configUnitPriceDraft}
                      readOnly={!isServiceCostEditable}
                      onFocus={(e) => {
                        if (!isServiceCostEditable) e.target.blur();
                      }}
                      onChange={(e) => {
                        const v = e.target.value.replace(',', '.');
                        if (v === '' || /^\d*\.?\d*$/.test(v)) {
                          setConfigUnitPriceDraft(v);
                        }
                      }}
                      onBlur={() => {
                        setConfigUnitPriceDraft((prev) => {
                          const parsed = parseRupeesDraftToPaise(prev);
                          if (parsed == null) return prev;
                          return paiseToRupeesDraft(parsed);
                        });
                      }}
                      placeholder="0"
                      className={cn(
                        'h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none px-3 pr-10',
                        !isServiceCostEditable && 'cursor-default select-none',
                      )}
                      style={{
                        color: !isServiceCostEditable
                          ? 'rgb(107, 114, 128)'
                          : qtyInputColor,
                      }}
                      aria-label="Service cost in rupees"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center transition-colors hover:opacity-80"
                      style={{
                        color: primary,
                      }}
                      aria-label={
                        isServiceCostEditable
                          ? 'Reset service cost to catalog price'
                          : 'Edit service cost'
                      }
                      title={
                        isServiceCostEditable
                          ? 'Reset to catalog price'
                          : 'Edit service cost'
                      }
                      onClick={() => {
                        if (isServiceCostEditable) {
                          if (configPricePaise != null) {
                            setConfigUnitPriceDraft(paiseToRupeesDraft(configPricePaise));
                          }
                          setIsServiceCostEditable(false);
                        } else {
                          setIsServiceCostEditable(true);
                        }
                      }}
                    >
                      {isServiceCostEditable ? (
                        <RotateCcw className="h-4 w-4" aria-hidden />
                      ) : (
                        <Pencil className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isServiceCostEditable
                      ? 'Tap reset to restore the catalog price for this segment and service.'
                      : 'Tap the pencil to override. Override applies to this invoice line only.'}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Remarks
                  </label>
                  <div
                    className="rounded-md border-2"
                    style={{
                      borderColor: qtyWrapBorder,
                      backgroundColor: qtyWrapBg,
                    }}
                  >
                    <Input
                      type="text"
                      autoComplete="off"
                      value={configRemarksDraft}
                      onChange={(e) => {
                        setConfigRemarksDraft(e.target.value.slice(0, REMARKS_MAX));
                      }}
                      placeholder="—"
                      className="h-10 border-0 bg-transparent text-sm font-normal leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none px-3 [&:not(:placeholder-shown)]:font-normal [&:not(:placeholder-shown)]:text-neutral-900"
                      style={{ color: qtyInputColor }}
                      aria-label="Remarks (optional)"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Optional. Shown on the invoice for this line.</p>
                </div>
              </div>
              {configTotalPaise != null && (
                <p className="text-sm font-medium">Total: {formatMoney(configTotalPaise)}</p>
              )}
              {configSegmentId && configServices.length === 0 && (
                <p className="text-xs text-muted-foreground">No services with price for this segment. Add in Catalog.</p>
              )}
              <Button
                type="button"
                variant="default"
                className="w-full hover:opacity-90"
                style={{
                  backgroundColor: primary,
                  color: onPrimaryFor(primary),
                }}
                onClick={() => {
                  const q = parseValidInvoiceQty(configQtyDraft);
                  const unitPaise = parseRupeesDraftToPaise(configUnitPriceDraft);
                  if (q == null || unitPaise == null || !configItemId) return;
                  const remarks = configRemarksDraft.trim().slice(0, REMARKS_MAX);
                  handleAdd(configItemId, q, unitPaise, remarks || undefined);
                }}
                disabled={!configSegmentId || !configServiceId || parsedConfigQty == null || parsedConfigUnitPaise == null}
              >
                Add to invoice
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
