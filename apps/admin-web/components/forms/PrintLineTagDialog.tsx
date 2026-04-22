'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';

/**
 * Thermal label: 38 mm × 20 mm page, 1.5 mm padding on all sides.
 * Lines: branch-dd-mm-yy, sequence-WI|ON, spacer, item, service; copy count at bottom (current/total).
 */
const LABEL_W_MM = 38;
const LABEL_H_MM = 20;
const LABEL_PADDING_MM = 1.5;

export interface PrintLineTagPayload {
  /** Pickup date as dd-mm-yy; shown on line 1 after branch as `BRANCH-dd-mm-yy`. */
  tagDateDdMmYy: string;
  /** Item name. */
  tagItemName: string;
  /** Service label (matrix service, else segment, else —). */
  tagServiceLabel: string;
  /** Branch short name / tag brand prefix (e.g. TKS). */
  brandPrefix: string;
  /** Line 2 only: sequence + WI/ON (e.g. 001-WI), bold. */
  orderNumberWithSuffix: string;
  defaultCopies: number;
}

/**
 * Line 3: only `NNN-WI` / `NNN-ON` — order ids often embed `-WI`/`-ON`; strip that
 * and use {@link walkIn} so the suffix is never duplicated.
 */
export function buildLineTagOrderLine(orderId: string, walkIn: boolean): string {
  const suffix = walkIn ? 'WI' : 'ON';
  const id = orderId.trim();
  if (!id) return `—-${suffix}`;
  const withoutSource = id.replace(/-(WI|ON)$/i, '');
  const tail = withoutSource.split('-').pop() ?? withoutSource;
  if (/^\d+$/.test(tail)) {
    return `${tail}-${suffix}`;
  }
  if (id.includes('-')) {
    const parts = id.split('-');
    const last = parts[parts.length - 1] ?? id;
    if (/^\d+$/.test(last)) {
      return `${last}-${suffix}`;
    }
  }
  return `${id}-${suffix}`;
}

interface PrintLineTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: PrintLineTagPayload | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Line 1: `BRANCH-dd-mm-yy` when branch is set; otherwise date only. */
function buildTagBranchDateLine(brandRaw: string, dateRaw: string): string {
  const date = (dateRaw || '').trim() || '—';
  const brand = (brandRaw || '').trim();
  if (!brand || brand === '—') return date;
  return `${brand}-${date}`;
}

function buildPrintHtml(payload: PrintLineTagPayload, copies: number): string {
  const d1 = ((payload.tagDateDdMmYy || '').trim() || '—').trim();
  const item = ((payload.tagItemName || '').trim() || '—').trim();
  const svc = ((payload.tagServiceLabel || '').trim() || '—').trim();
  const brand = ((payload.brandPrefix || '').trim() || '—').trim();
  const ord = ((payload.orderNumberWithSuffix || '').trim() || '—').trim();
  const headLine = buildTagBranchDateLine(brand, d1);

  const pages = Array.from({ length: copies }, (_, copyIdx) => {
    const current = copyIdx + 1;
    return `
    <div class="label-page">
      <div class="label-inner">
        <div class="tag-block">
          <div class="tag-line-head">${escapeHtml(headLine)}</div>
          <div class="tag-seq-line">${escapeHtml(ord)}</div>
          <div class="tag-spacer" aria-hidden="true"></div>
          <div class="tag-item">${escapeHtml(item)}</div>
          <div class="tag-service">${escapeHtml(svc)}</div>
        </div>
        <div class="tag-qty">${current}/${copies}</div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Line labels</title>
<style>
@page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.label-page {
  width: ${LABEL_W_MM}mm;
  height: ${LABEL_H_MM}mm;
  page-break-after: always;
  padding: ${LABEL_PADDING_MM}mm;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  color: #111;
}
.label-page:last-child { page-break-after: auto; }
.label-inner {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  border: 0.2mm solid #222;
  padding: 0.35mm 0.5mm;
}
.tag-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 0.1mm;
  gap: 0.06mm;
  text-align: center;
  overflow: hidden;
}
.tag-line-head {
  font-size: 7.1pt;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0.02em;
  color: #000;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-seq-line {
  font-size: 7.2pt;
  font-weight: 900;
  line-height: 1.08;
  color: #000;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tag-spacer {
  flex-shrink: 0;
  width: 100%;
  height: 0.28em;
  font-size: 7.35pt;
  line-height: 1;
}
.tag-item,
.tag-service {
  font-size: 7.45pt;
  line-height: 1.14;
  color: #111;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-item {
  font-weight: 700;
}
.tag-service {
  font-weight: 600;
}
.tag-qty {
  flex-shrink: 0;
  text-align: center;
  font-size: 6.35pt;
  font-weight: 700;
  color: #333;
  line-height: 1.08;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}
</style></head><body>${pages}</body></html>`;
}

function runPrintJob(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print labels');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  );
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120_000);

  const doPrint = () => {
    win.focus();
    win.print();
  };

  void (async () => {
    try {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      );
      doPrint();
    } catch {
      doPrint();
    }
  })();
}

export function PrintLineTagDialog({ open, onOpenChange, payload }: PrintLineTagDialogProps) {
  const [copies, setCopies] = useState(1);
  const [copiesDraft, setCopiesDraft] = useState('1');
  const [printLoading, setPrintLoading] = useState(false);

  useEffect(() => {
    if (!open || !payload) return;
    const c = Math.max(1, Math.min(999, Math.ceil(Number(payload.defaultCopies) || 1)));
    setCopies(c);
    setCopiesDraft(String(c));
  }, [open, payload]);

  const handlePrint = useCallback(() => {
    if (!payload) return;
    const parsed = parseInt(copiesDraft, 10);
    const n = Math.max(1, Math.min(999, Number.isFinite(parsed) ? parsed : copies));
    setPrintLoading(true);
    try {
      const html = buildPrintHtml(payload, n);
      runPrintJob(html);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Could not build label. Try again.');
    } finally {
      setPrintLoading(false);
    }
  }, [payload, copiesDraft, copies, onOpenChange]);

  if (!payload) {
    return null;
  }

  const previewDate = (payload.tagDateDdMmYy || '').trim() || '—';
  const previewItem = (payload.tagItemName || '').trim() || '—';
  const previewSvc = (payload.tagServiceLabel || '').trim() || '—';
  const previewBrand = (payload.brandPrefix || '').trim() || '—';
  const previewOrd = (payload.orderNumberWithSuffix || '').trim() || '—';
  const previewHead = buildTagBranchDateLine(previewBrand, previewDate);
  const previewTotal = Math.max(1, parseInt(copiesDraft, 10) || copies || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print line tag</DialogTitle>
          <DialogDescription className="sr-only">
            Preview matches the printed label. 38 by 20 millimetres:             branch hyphen date, bold sequence with WI or ON, thin gap, item and service, copy count.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="mx-auto w-full max-w-[280px] rounded-md border bg-muted/30 p-3">
            <div
              className="flex w-full max-h-[200px] flex-col items-stretch justify-between gap-0.5 border border-border bg-background px-1 py-0.5 text-center leading-tight"
              style={{ aspectRatio: `${LABEL_W_MM} / ${LABEL_H_MM}` }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-px overflow-hidden pt-0.5">
                <p className="w-full max-w-full truncate text-[10px] font-extrabold leading-none">{previewHead}</p>
                <p className="w-full max-w-full truncate font-mono text-[10px] font-extrabold leading-tight">
                  {previewOrd}
                </p>
                <div className="h-[2px] w-full shrink-0" aria-hidden />
                <p className="w-full max-w-full truncate text-[11px] font-bold leading-snug">{previewItem}</p>
                <p className="w-full max-w-full truncate text-[11px] font-semibold leading-snug text-foreground/95">
                  {previewSvc}
                </p>
              </div>
              <p className="text-[9px] font-bold leading-none text-muted-foreground tabular-nums shrink-0">
                1/{previewTotal}
              </p>
            </div>
          </div>

          <FormField label="Number of copies (labels)" htmlFor="tag-copies">
            <Input
              id="tag-copies"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="h-9 max-w-[120px]"
              value={copiesDraft}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setCopiesDraft(v);
                if (v !== '') {
                  const num = parseInt(v, 10);
                  if (Number.isFinite(num)) setCopies(Math.max(1, Math.min(999, num)));
                }
              }}
              onBlur={() => {
                const num = parseInt(copiesDraft, 10);
                const c = Number.isFinite(num) ? Math.max(1, Math.min(999, num)) : 1;
                setCopies(c);
                setCopiesDraft(String(c));
              }}
            />
          </FormField>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={printLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => handlePrint()} disabled={printLoading}>
            {printLoading ? 'Preparing…' : 'Print tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
