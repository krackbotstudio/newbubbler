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
 * Thermal label: 36 mm × 30 mm page, 2 mm padding on all sides.
 * Text only — no QR.
 */
const LABEL_W_MM = 36;
const LABEL_H_MM = 30;
const LABEL_PADDING_MM = 2;

export interface PrintLineTagPayload {
  /** Top line on the tag (branch “short brand” / item tag brand from branch details, or fallbacks from caller). */
  brandName: string;
  customerName: string;
  orderNumber: string;
  itemName: string;
  segment: string;
  service: string;
  defaultCopies: number;
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

function buildPrintHtml(
  tagTitle: string,
  customerName: string,
  orderNumber: string,
  itemName: string,
  service: string,
  copies: number
): string {
  const title = (tagTitle || '—').trim() || '—';
  const customer = (customerName || '—').trim();
  const item = (itemName || '—').trim();
  const svc = (service || '—').trim();

  const pages = Array.from({ length: copies }, (_, copyIdx) => {
    const current = copyIdx + 1;
    return `
    <div class="label-page">
      <div class="label-inner">
        <div class="tag-title">${escapeHtml(title)}</div>
        <div class="tag-customer">${escapeHtml(customer)}</div>
        <div class="tag-order">${escapeHtml(orderNumber.trim())}</div>
        <div class="tag-details-stack">
          <div class="tag-line">${escapeHtml(item)}</div>
          <div class="tag-line">${escapeHtml(svc)}</div>
        </div>
        <div class="tag-qty">${current} / ${copies}</div>
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
  justify-content: flex-start;
  gap: 0.3mm;
  border: 0.25mm solid #333;
  padding: 0.55mm 0.8mm;
}
.tag-title {
  text-align: center;
  font-size: 9.5pt;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.02;
  color: #000;
}
.tag-customer {
  text-align: center;
  font-size: 8.25pt;
  font-weight: 800;
  line-height: 1.02;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag-order {
  font-size: 7.75pt;
  font-weight: 700;
  line-height: 1.02;
  word-break: break-all;
  text-align: center;
  letter-spacing: -0.01em;
}
.tag-details-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.2mm;
  text-align: center;
}
.tag-line {
  font-size: 9pt;
  font-weight: 800;
  line-height: 1.02;
  word-break: break-word;
  color: #000;
}
.tag-qty {
  margin-top: auto;
  flex-shrink: 0;
  text-align: center;
  font-size: 7.75pt;
  font-weight: 700;
  color: #222;
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
      const tagTitle = (payload.brandName || '').trim() || '—';
      const html = buildPrintHtml(
        tagTitle,
        payload.customerName,
        payload.orderNumber,
        payload.itemName,
        payload.service,
        n
      );
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

  const previewBrand = (payload.brandName || '').trim() || '—';
  const previewCustomer = (payload.customerName || '—').trim();
  const previewItem = (payload.itemName || '—').trim();
  const previewService = (payload.service || '—').trim();

  const previewTotal = Math.max(1, parseInt(copiesDraft, 10) || copies || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print line tag</DialogTitle>
          <DialogDescription className="sr-only">
            Preview matches the printed label. 36 by 30 millimetres with two millimetre margins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="mx-auto w-full max-w-[280px] rounded-md border bg-muted/30 p-3">
            <div className="flex aspect-[36/30] max-h-[260px] w-full flex-col items-stretch justify-between gap-1 border border-border bg-background px-2 py-2.5 text-center leading-tight">
              <p className="text-xs font-extrabold truncate">{previewBrand}</p>
              <p className="text-[11px] font-extrabold truncate">{previewCustomer}</p>
              <p className="font-mono text-[11px] font-bold break-all">{payload.orderNumber}</p>
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-0.5">
                <p className="text-xs font-extrabold text-foreground">{previewItem}</p>
                <p className="text-xs font-extrabold text-foreground">{previewService}</p>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                1 / {previewTotal}
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
