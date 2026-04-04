'use client';

import { useCallback, useState, type RefObject } from 'react';
import { getToken } from '@/lib/auth';
import { phoneDigitsForWhatsApp } from '@/lib/format';
import { toast } from 'sonner';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Desktop Chrome (Windows/macOS) implements `navigator.share` but opens the OS share sheet, not the customer's chat. */
export function isMobileDeviceForShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function buildPrintStylesheet(printRootId: string, printCloneClass: string): string {
  const root = `#${printRootId}`;
  const clone = `.${printCloneClass}`;
  return `@media print{html,body{margin:0!important;padding:0!important}body ${root},body ${root} *{visibility:visible!important}body>*{display:none!important}body>${root}{display:block!important}${root}{position:static!important;margin:0!important;padding:0!important}${clone}{margin:0!important;padding:0 0.5rem 0.5rem!important;max-width:100%!important;page-break-inside:avoid!important}${clone}.invoice-print-view{padding:0.25rem 0.5rem!important;gap:0.25rem!important}${clone}.invoice-print-view>*{margin-top:0.25rem!important;margin-bottom:0!important}${clone} .invoice-print-header-logo{border-bottom-width:1px!important;padding-bottom:0.25rem!important}${clone} [class*="pb-4"]{padding-bottom:0.25rem!important}${clone} [class*="py-2"]{padding-top:0.15rem!important;padding-bottom:0.15rem!important}${clone} [class*="py-3"]{padding-top:0.2rem!important;padding-bottom:0.2rem!important}${clone} [class*="p-3"]{padding:0.25rem!important}${clone} [class*="p-2"]{padding:0.2rem!important}${clone} [class*="mt-4"],[class*="mt-6"]{margin-top:0.25rem!important}${clone} [class*="pt-4"]{padding-top:0.25rem!important}${clone} table th,${clone} table td{padding-top:0.15rem!important;padding-bottom:0.15rem!important}${clone} img{max-height:2rem!important;height:2rem!important}}@media screen{${root}{display:none!important}}`;
}

export interface UseIssuedInvoiceShareActionsOpts {
  pdfUrl: string | null;
  /** Used in download filename fallback */
  orderId: string;
  /** Invoice code / number for filenames (e.g. ACK code or IN{id}) */
  invoiceLabelForFile: string;
  buildWhatsAppMessage: () => string;
  customerPhone: string | null | undefined;
  /** For WhatsApp attachment base name */
  shareFileLabelPrefix: 'Ack' | 'Final';
  printStyleId: string;
  printRootId: string;
  printCloneClass: string;
}

/**
 * Print (clone + dedicated print root), Download PDF (html2pdf → server PDF fallback),
 * Share on WhatsApp (JPEG → PDF → mobile Web Share → desktop wa.me + download), matching Ack dialog behaviour.
 */
export function useIssuedInvoiceShareActions(
  printRef: RefObject<HTMLElement | null>,
  opts: UseIssuedInvoiceShareActionsOpts,
) {
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const {
    pdfUrl,
    orderId,
    invoiceLabelForFile,
    buildWhatsAppMessage,
    customerPhone,
    shareFileLabelPrefix,
    printStyleId,
    printRootId,
    printCloneClass,
  } = opts;

  const safeFileStem = `${invoiceLabelForFile || orderId}`.replace(/[^\w.\-]+/g, '_');
  const downloadBasename = `${shareFileLabelPrefix.toLowerCase()}-${safeFileStem}`;

  const handlePrint = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add(printCloneClass);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('id', printRootId);
    wrapper.style.cssText =
      'position:absolute;left:0;top:0;width:100%;margin:0;padding:0;z-index:99999;pointer-events:none;';
    wrapper.appendChild(clone);
    const style = document.createElement('style');
    style.id = printStyleId;
    style.textContent = buildPrintStylesheet(printRootId, printCloneClass);
    document.body.appendChild(style);
    document.body.insertBefore(wrapper, document.body.firstChild);
    requestAnimationFrame(() => {
      window.print();
      requestAnimationFrame(() => {
        wrapper.remove();
        document.getElementById(printStyleId)?.remove();
      });
    });
  }, [printRef, printCloneClass, printRootId, printStyleId]);

  const handleDownload = useCallback(async () => {
    const element = printRef.current;
    if (element) {
      setDownloadLoading(true);
      try {
        element.classList.add('pdf-capture');
        await new Promise((r) => setTimeout(r, 150));
        const html2pdf = (await import('html2pdf.js')).default;
        await html2pdf()
          .set({
            margin: 10,
            filename: `${downloadBasename}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(element)
          .save();
      } catch {
        if (pdfUrl) {
          const token = getToken();
          const res = await fetch(pdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${downloadBasename}.pdf`;
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
      a.download = `${downloadBasename}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(pdfUrl, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }, [downloadBasename, pdfUrl, printRef]);

  const resolvePdfBlob = useCallback(async (): Promise<Blob | null> => {
    if (pdfUrl) {
      try {
        const token = getToken();
        const res = await fetch(pdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0) return blob;
        }
      } catch {
        /* fall through */
      }
    }
    const element = printRef.current;
    if (!element) return null;
    element.classList.add('pdf-capture');
    try {
      await new Promise((r) => setTimeout(r, 150));
      const html2pdf = (await import('html2pdf.js')).default;
      const worker = html2pdf()
        .set({
          margin: 10,
          filename: `${downloadBasename}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element);
      const w = worker as unknown as {
        outputPdf?: (type: string) => Promise<Blob>;
        output?: (type: string) => Promise<Blob>;
      };
      const generated =
        typeof w.outputPdf === 'function'
          ? await w.outputPdf('blob')
          : typeof w.output === 'function'
            ? await w.output('blob')
            : null;
      return generated && generated.size > 0 ? generated : null;
    } catch {
      return null;
    } finally {
      element.classList.remove('pdf-capture');
    }
  }, [downloadBasename, pdfUrl, printRef]);

  const resolveJpegBlob = useCallback(async (): Promise<Blob | null> => {
    const element = printRef.current;
    if (!element) return null;
    element.classList.add('pdf-capture');
    try {
      await new Promise((r) => setTimeout(r, 150));
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        removeContainer: true,
        foreignObjectRendering: false,
      });
      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b && b.size > 0 ? b : null), 'image/jpeg', 0.92);
      });
    } catch {
      return null;
    } finally {
      element.classList.remove('pdf-capture');
    }
  }, [printRef]);

  const handleWhatsAppShare = useCallback(async () => {
    const text = buildWhatsAppMessage();
    const waDigits = phoneDigitsForWhatsApp(customerPhone);
    setShareLoading(true);
    try {
      const baseName = `${shareFileLabelPrefix}-${safeFileStem}`;
      let blob: Blob | null = await resolveJpegBlob();
      let mime: 'image/jpeg' | 'application/pdf' = 'image/jpeg';
      let filename = `${baseName}.jpg`;
      if (!blob) {
        blob = await resolvePdfBlob();
        mime = 'application/pdf';
        filename = `${baseName}.pdf`;
      }

      const tryNativeShare = blob && isMobileDeviceForShare() && typeof navigator.share === 'function';
      if (tryNativeShare && blob) {
        const file = new File([blob], filename, { type: mime, lastModified: Date.now() });
        const withText: ShareData = { files: [file], text };
        try {
          await navigator.share(withText);
          return;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
        }
        try {
          await navigator.share({ files: [file] });
          toast.message('Caption was not bundled — paste your message in WhatsApp if needed.');
          return;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
        }
      }

      if (!blob) {
        toast.error('Could not prepare the invoice image or PDF. Try Download PDF, then attach it in WhatsApp.');
      } else {
        downloadBlob(blob, filename);
        toast.success(
          mime === 'image/jpeg'
            ? 'Invoice image saved — opening WhatsApp with this customer; attach the JPEG from Downloads before sending.'
            : 'Invoice PDF saved — opening WhatsApp with this customer; attach the file from Downloads before sending.',
        );
      }
      if (!waDigits) {
        toast.warning('Customer phone is missing. Opening WhatsApp without a direct chat.');
      }
      const url = waDigits
        ? `https://wa.me/${waDigits}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setShareLoading(false);
    }
  }, [
    buildWhatsAppMessage,
    customerPhone,
    resolveJpegBlob,
    resolvePdfBlob,
    safeFileStem,
    shareFileLabelPrefix,
  ]);

  return {
    handlePrint,
    handleDownload,
    handleWhatsAppShare,
    downloadLoading,
    shareLoading,
  };
}
