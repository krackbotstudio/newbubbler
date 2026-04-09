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
import { Search } from 'lucide-react';

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
}

const CHEVRON_SVG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23be185d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

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

export function AddItemsToInvoiceDialog({
  open,
  onOpenChange,
  catalogMatrix,
  onAddLine,
}: AddItemsToInvoiceDialogProps) {
  const [configItemId, setConfigItemId] = useState<string | null>(null);
  const [segmentByItem, setSegmentByItem] = useState<Record<string, string>>({});
  const [serviceByItem, setServiceByItem] = useState<Record<string, string>>({});
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [configQtyDraft, setConfigQtyDraft] = useState('1');

  useEffect(() => {
    if (!open) setItemSearch('');
  }, [open]);

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
  const parsedConfigQty = useMemo(() => parseValidInvoiceQty(configQtyDraft), [configQtyDraft]);
  const configTotalPaise =
    configPricePaise != null && parsedConfigQty != null
      ? Math.round(configPricePaise * parsedConfigQty)
      : null;

  const handleAdd = useCallback(
    (itemId: string, qty: number) => {
      const item = catalogMatrix.items.find((i) => i.id === itemId);
      if (!item) return;
      const segmentId = segmentByItem[itemId];
      const serviceId = serviceByItem[itemId];
      if (!segmentId || !serviceId) return;
      const unitPaise = getPricePaise(catalogMatrix, itemId, segmentId, serviceId);
      if (unitPaise == null) return;
      const amount = Math.round(qty * unitPaise);
      setQtyByItem((prev) => ({ ...prev, [itemId]: qty }));
      onAddLine({
        type: 'DRYCLEAN_ITEM',
        name: item.name,
        quantity: qty,
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
                onClick={() => openConfig(item.id)}
              >
                <span className="flex items-center justify-center w-14 h-14 rounded-lg border bg-muted/50 mb-1.5 shrink-0">
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
                  className="h-10 w-full rounded-md border border-pink-200 bg-white pl-3 pr-8 py-2 text-sm text-pink-700 appearance-none bg-no-repeat dark:bg-background dark:border-pink-800 dark:text-pink-300"
                  style={{ backgroundImage: CHEVRON_SVG, backgroundPosition: 'right 8px center' }}
                  value={configSegmentId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSegmentByItem((prev) => ({ ...prev, [configItemId!]: v }));
                    setServiceByItem((prev) => ({ ...prev, [configItemId!]: '' }));
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
                  className="h-10 w-full rounded-md border border-pink-200 bg-white pl-3 pr-8 py-2 text-sm text-pink-700 appearance-none bg-no-repeat dark:bg-background dark:border-pink-800 dark:text-pink-300"
                  style={{ backgroundImage: CHEVRON_SVG, backgroundPosition: 'right 8px center' }}
                  value={configServiceId}
                  onChange={(e) => setServiceByItem((prev) => ({ ...prev, [configItemId!]: e.target.value }))}
                  disabled={!configSegmentId}
                >
                  <option value="">Select service</option>
                  {configServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Qty</label>
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
                  className="h-10"
                  aria-label="Quantity"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Minimum {MIN_INVOICE_ITEM_QTY}. Decimals allowed (e.g. 0.5 kg).
                </p>
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
                className="w-full"
                onClick={() => {
                  const q = parseValidInvoiceQty(configQtyDraft);
                  if (q == null || !configItemId) return;
                  handleAdd(configItemId, q);
                }}
                disabled={!configSegmentId || !configServiceId || parsedConfigQty == null}
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
