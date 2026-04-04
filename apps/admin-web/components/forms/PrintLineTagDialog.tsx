'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * TSC TE210–class thermal (203 DPI, max print width ~108 mm).
 * Layout sized for common die-cut labels (100 × 50 mm); fits within printer width.
 */
const LABEL_W_MM = 100;
const LABEL_H_MM = 50;

/** QR module size for sharp print when scaled down on label (~30 mm). */
const QR_CANVAS_PX = 512;
const PREVIEW_QR_PX = 220;

export interface PrintLineTagPayload {
  /** Shown top-center on the tag and in the QR payload first line. */
  brandName: string;
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

/** Human-readable payload; unique per order + item + segment + service. Scanners show this as text. */
function buildLineTagQrPayload(
  brandName: string,
  orderNumber: string,
  itemName: string,
  segment: string,
  service: string
): string {
  const brand = (brandName || 'We You').trim() || 'We You';
  const lines = [
    `${brand} · Item tag`,
    `Order: ${orderNumber.trim()}`,
    `Item: ${(itemName || '—').trim()}`,
    `Segment: ${(segment || '—').trim()}`,
    `Service: ${(service || '—').trim()}`,
  ];
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function createQrDataUrl(text: string, widthPx: number = QR_CANVAS_PX): Promise<string> {
  return QRCode.toDataURL(text, {
    width: widthPx,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

function buildPrintHtml(
  brandName: string,
  orderNumber: string,
  itemName: string,
  segment: string,
  service: string,
  copies: number,
  labelWmm: number,
  labelHmm: number,
  qrDataUrl: string
): string {
  const brand = escapeHtml((brandName || 'We You').trim() || 'We You');
  const pages = Array.from({ length: copies }, (_, copyIdx) => {
    return `
    <div class="label-page">
      <div class="label-inner">
        <div class="label-header">
          <div class="brand">${brand}</div>
          <div class="order">${escapeHtml(orderNumber)}</div>
        </div>
        <div class="label-body">
          <div class="label-main">
            <div class="item">${escapeHtml(itemName || '—')}</div>
            <div class="seg-svc"><span class="muted">Segment</span> ${escapeHtml(segment)}</div>
            <div class="seg-svc"><span class="muted">Service</span> ${escapeHtml(service)}</div>
          </div>
          <div class="label-qr">
            <img src="${qrDataUrl}" width="${QR_CANVAS_PX}" height="${QR_CANVAS_PX}" alt="" />
          </div>
        </div>
        <div class="copy">${copyIdx + 1} / ${copies}</div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Line labels</title>
<style>
@page { size: ${labelWmm}mm ${labelHmm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.label-page {
  width: ${labelWmm}mm;
  height: ${labelHmm}mm;
  page-break-after: always;
  padding: 2mm 2.5mm;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  color: #111;
}
.label-page:last-child { page-break-after: auto; }
.label-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  border: 0.35mm solid #222;
  padding: 1.5mm 2mm;
}
.label-header {
  flex-shrink: 0;
  width: 100%;
}
.brand {
  width: 100%;
  text-align: left;
  font-size: 9pt;
  font-weight: 900;
  letter-spacing: 0.03em;
  line-height: 1.15;
  margin-bottom: 0.6mm;
  color: #000;
}
.label-body {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 2mm;
  flex: 1;
  min-height: 0;
  margin-top: 3.5mm;
  padding-top: 0.5mm;
}
.label-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.label-qr {
  flex-shrink: 0;
  width: 26mm;
  display: flex;
  align-items: center;
  justify-content: center;
}
.label-qr img {
  width: 26mm;
  height: 26mm;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.order {
  font-size: 11pt;
  font-weight: 800;
  letter-spacing: 0.02em;
  margin-bottom: 0.5mm;
  line-height: 1.1;
  word-break: break-all;
  text-align: left;
  width: 100%;
}
.item {
  font-size: 15pt;
  font-weight: 900;
  line-height: 1.08;
  margin-bottom: 0.5mm;
  max-height: 14mm;
  overflow: hidden;
  text-align: left;
  width: 100%;
}
.seg-svc {
  font-size: 13pt;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 0.3mm;
  word-break: break-word;
  text-align: left;
  width: 100%;
}
.seg-svc .muted { color: #222; font-weight: 800; margin-right: 1.2mm; }
.copy {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 0.5mm;
  font-size: 8pt;
  font-weight: 600;
  color: #444;
  text-align: left;
  width: 100%;
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

  win.focus();
  win.print();
}

export function PrintLineTagDialog({ open, onOpenChange, payload }: PrintLineTagDialogProps) {
  const [copies, setCopies] = useState(1);
  const [copiesDraft, setCopiesDraft] = useState('1');
  const [printLoading, setPrintLoading] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [previewQrLoading, setPreviewQrLoading] = useState(false);

  useEffect(() => {
    if (!open || !payload) return;
    const c = Math.max(1, Math.min(999, Math.ceil(Number(payload.defaultCopies) || 1)));
    setCopies(c);
    setCopiesDraft(String(c));
  }, [open, payload]);

  useEffect(() => {
    if (!open || !payload) {
      setPreviewQrUrl(null);
      return;
    }
    let cancelled = false;
    setPreviewQrLoading(true);
    const text = buildLineTagQrPayload(
      payload.brandName,
      payload.orderNumber,
      payload.itemName,
      payload.segment,
      payload.service
    );
    void createQrDataUrl(text, PREVIEW_QR_PX)
      .then((url) => {
        if (!cancelled) setPreviewQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewQrUrl(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, payload]);

  const handlePrint = useCallback(async () => {
    if (!payload) return;
    const parsed = parseInt(copiesDraft, 10);
    const n = Math.max(1, Math.min(999, Number.isFinite(parsed) ? parsed : copies));
    setPrintLoading(true);
    try {
      const qrText = buildLineTagQrPayload(
        payload.brandName,
        payload.orderNumber,
        payload.itemName,
        payload.segment,
        payload.service
      );
      const qrDataUrl = await createQrDataUrl(qrText);
      const html = buildPrintHtml(
        payload.brandName,
        payload.orderNumber,
        payload.itemName,
        payload.segment,
        payload.service,
        n,
        LABEL_W_MM,
        LABEL_H_MM,
        qrDataUrl
      );
      runPrintJob(html);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Could not build label or QR code. Try again.');
    } finally {
      setPrintLoading(false);
    }
  }, [payload, copiesDraft, copies, onOpenChange]);

  if (!payload) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print line tag</DialogTitle>
          <DialogDescription className="sr-only">
            Preview matches the printed label. Same QR encodes order, item, segment, and service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-center font-bold text-base border-b border-border pb-2 mb-3">
              {payload.brandName}
            </p>
            <div className="mt-2 flex flex-row items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1.5 text-left">
                <p>
                  <span className="text-muted-foreground">Order</span>{' '}
                  <span className="font-mono font-semibold break-all">{payload.orderNumber}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Item</span>{' '}
                  <span className="font-semibold">{payload.itemName || '—'}</span>
                </p>
                <p className="text-base font-bold leading-snug">
                  <span className="text-muted-foreground font-semibold">Segment</span>{' '}
                  <span>{payload.segment}</span>
                </p>
                <p className="text-base font-bold leading-snug">
                  <span className="text-muted-foreground font-semibold">Service</span>{' '}
                  <span>{payload.service}</span>
                </p>
              </div>
              <div
                className={cn(
                  'flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-md border bg-white p-1',
                  previewQrLoading && 'border-dashed'
                )}
              >
                {previewQrLoading && <Skeleton className="h-full w-full rounded" />}
                {!previewQrLoading && previewQrUrl && (
                  <img
                    src={previewQrUrl}
                    alt=""
                    width={PREVIEW_QR_PX}
                    height={PREVIEW_QR_PX}
                    className="h-full w-full object-contain"
                  />
                )}
                {!previewQrLoading && !previewQrUrl && (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">QR unavailable</span>
                )}
              </div>
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
          <Button type="button" onClick={() => void handlePrint()} disabled={printLoading}>
            {printLoading ? 'Preparing…' : 'Print tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
