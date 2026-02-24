'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CatalogItemIcon } from '@/components/catalog/CatalogItemIcon';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CatalogMatrixResponse } from '@/types/catalog';
import type { InvoiceLineRow } from './InvoiceBuilder';
import { formatMoney } from '@/lib/format';

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

export function AddItemsToInvoiceDialog({
  open,
  onOpenChange,
  catalogMatrix,
  onAddLine,
}: AddItemsToInvoiceDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [segmentByItem, setSegmentByItem] = useState<Record<string, string>>({});
  const [serviceByItem, setServiceByItem] = useState<Record<string, string>>({});
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});

  const activeItems = catalogMatrix.items.filter((i) => i.active);

  const handleAdd = useCallback(
    (itemId: string) => {
      const item = catalogMatrix.items.find((i) => i.id === itemId);
      if (!item) return;
      const segmentId = segmentByItem[itemId];
      const serviceId = serviceByItem[itemId];
      if (!segmentId || !serviceId) return;
      const unitPaise = getPricePaise(catalogMatrix, itemId, segmentId, serviceId);
      if (unitPaise == null) return;
      const qty = Math.max(1, qtyByItem[itemId] ?? 1);
      const amount = qty * unitPaise;
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
      onOpenChange(false);
    },
    [catalogMatrix, segmentByItem, serviceByItem, qtyByItem, onAddLine, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add items to invoice</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Expand an item, choose Segment and Service, then add to invoice.
        </p>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto min-h-0 py-2">
          {activeItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const segments = getSegmentsForItem(catalogMatrix, item.id);
            const segmentId = segmentByItem[item.id] ?? '';
            const services = getServicesForItemAndSegment(catalogMatrix, item.id, segmentId);
            const serviceId = serviceByItem[item.id] ?? '';
            const pricePaise = segmentId && serviceId
              ? getPricePaise(catalogMatrix, item.id, segmentId, serviceId)
              : null;
            const qty = Math.max(1, qtyByItem[item.id] ?? 1);
            const totalPaise = pricePaise != null ? pricePaise * qty : null;

            return (
              <div
                key={item.id}
                className="relative rounded-lg border bg-card min-h-[72px] flex flex-col"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors flex-shrink-0 min-h-[72px]"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                    <CatalogItemIcon icon={item.icon} size={28} />
                  </span>
                  <span className="flex-1 font-medium truncate text-sm">{item.name}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-0.5 rounded-md border bg-popover shadow-lg px-3 py-3 space-y-3 min-w-[240px] max-h-[280px] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Segment</label>
                      <select
                        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={segmentId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSegmentByItem((prev) => ({ ...prev, [item.id]: v }));
                          setServiceByItem((prev) => ({ ...prev, [item.id]: '' }));
                        }}
                      >
                        <option value="">Select segment</option>
                        {segments.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Service</label>
                      <select
                        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                        value={serviceId}
                        onChange={(e) =>
                          setServiceByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        disabled={!segmentId}
                      >
                        <option value="">Select service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Qty</label>
                        <Input
                          type="number"
                          min={1}
                          value={qtyByItem[item.id] ?? 1}
                          onChange={(e) =>
                            setQtyByItem((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="h-9 w-20 mt-1"
                        />
                      </div>
                      {totalPaise != null && (
                        <span className="text-sm font-medium">{formatMoney(totalPaise)}</span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAdd(item.id)}
                        disabled={!segmentId || !serviceId}
                      >
                        Add to invoice
                      </Button>
                    </div>
                    {segmentId && services.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No services with price for this segment. Add in Catalog.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
