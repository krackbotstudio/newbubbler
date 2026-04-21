import type { PdfGenerator, InvoicePdfAggregate } from '../../application/ports';

/** Escape string for PDF text operator Tj: \ ( ) must be escaped. */
function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Builds a small self-contained PDF (PDF 1.1) with a simple invoice layout.
 * We keep it dependency-free (no headless chrome / pdfkit) and rely on basic
 * PDF text operators + a few line drawing ops for a structured look.
 */
function buildMinimalPdf(aggregate: InvoicePdfAggregate): Buffer {
  const b = aggregate.branding;
  const money = (paise: number) => (paise / 100).toFixed(2);
  const issued = aggregate.issuedAt.toISOString().slice(0, 19).replace('T', ' ');

  const fontNormal = 10;
  const fontSmall = 9;
  const fontTitle = 16;
  const fontH = 12;
  const marginX = 44;
  const pageW = 612;
  const pageH = 792;
  const contentW = pageW - marginX * 2;

  const contentParts: string[] = [];
  const setFont = (size: number) => contentParts.push('BT', `/F1 ${size} Tf`);
  const textAt = (x: number, y: number, s: string) => {
    contentParts.push(`1 0 0 1 ${x} ${y} Tm`);
    contentParts.push(`(${pdfEscape(s)}) Tj`);
  };
  const endText = () => contentParts.push('ET');
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    contentParts.push('0 0 0 RG', '1 w', `${x1} ${y1} m`, `${x2} ${y2} l`, 'S');
  };

  // Header
  setFont(fontTitle);
  textAt(marginX, pageH - 64, 'INVOICE');
  endText();

  setFont(fontNormal);
  textAt(marginX, pageH - 84, b.businessName || 'Business');
  endText();

  setFont(fontSmall);
  if (b.address) {
    textAt(marginX, pageH - 98, b.address);
  }
  const contact = [b.email, b.phone].filter(Boolean).join(' · ');
  if (contact) textAt(marginX, pageH - 110, contact);
  endText();

  // Top meta (right aligned-ish by placing near right edge)
  const rightX = marginX + contentW * 0.62;
  setFont(fontSmall);
  textAt(rightX, pageH - 86, `Type: ${aggregate.type}`);
  textAt(rightX, pageH - 98, `Invoice #: ${aggregate.invoiceId}`);
  if (aggregate.type !== 'SUBSCRIPTION') textAt(rightX, pageH - 110, `Order ID: ${aggregate.orderId ?? '—'}`);
  textAt(rightX, pageH - 122, `Issued: ${issued}`);
  endText();

  line(marginX, pageH - 132, pageW - marginX, pageH - 132);

  // Customer block
  let y = pageH - 156;
  setFont(fontH);
  textAt(marginX, y, 'Customer');
  endText();
  y -= 16;
  setFont(fontNormal);
  if (aggregate.customerName) {
    textAt(marginX, y, aggregate.customerName);
    y -= 14;
  }
  if (aggregate.customerPhone) {
    textAt(marginX, y, aggregate.customerPhone);
    y -= 14;
  }
  if (!aggregate.customerName && !aggregate.customerPhone) {
    textAt(marginX, y, '—');
    y -= 14;
  }
  endText();

  // Tax IDs
  setFont(fontSmall);
  const taxY = pageH - 156;
  if (b.panNumber) textAt(rightX, taxY, `PAN: ${b.panNumber}`);
  if (b.gstNumber) textAt(rightX, taxY - 12, `GST: ${b.gstNumber}`);
  endText();

  y -= 8;
  line(marginX, y, pageW - marginX, y);
  y -= 18;

  // Items table header
  const colName = marginX;
  const colQty = marginX + contentW * 0.48;
  const colClothes = marginX + contentW * 0.58;
  const colUnit = marginX + contentW * 0.72;
  const colAmt = marginX + contentW * 0.88;

  setFont(fontH);
  textAt(marginX, y, 'Items');
  endText();
  y -= 16;

  setFont(fontSmall);
  textAt(colName, y, 'Name');
  textAt(colQty, y, 'Qty');
  textAt(colClothes, y, 'Clothes');
  textAt(colUnit, y, 'Unit (₹)');
  textAt(colAmt, y, 'Amount (₹)');
  endText();
  y -= 8;
  line(marginX, y, pageW - marginX, y);
  y -= 14;

  // Rows (simple truncation)
  setFont(fontNormal);
  const maxNameLen = 42;
  for (const item of aggregate.items) {
    const name = item.name.length > maxNameLen ? item.name.slice(0, maxNameLen - 1) + '…' : item.name;
    textAt(colName, y, name);
    textAt(colQty, y, String(item.quantity));
    const clothes =
      item.clothesCount != null && Number.isFinite(item.clothesCount)
        ? String(item.clothesCount)
        : String(item.quantity);
    textAt(colClothes, y, clothes);
    textAt(colUnit, y, money(item.unitPrice));
    textAt(colAmt, y, money(item.amount));
    y -= 14;
    if (y < 140) break; // keep within one page (safe)
  }
  endText();

  // Totals
  y -= 4;
  line(marginX, y, pageW - marginX, y);
  y -= 18;

  setFont(fontH);
  textAt(colAmt - 120, y, `Subtotal: ₹${money(aggregate.subtotal)}`);
  y -= 16;
  if (aggregate.tax > 0) {
    textAt(colAmt - 120, y, `Tax: ₹${money(aggregate.tax)}`);
    y -= 16;
  }
  if (aggregate.discountPaise != null && aggregate.discountPaise > 0) {
    textAt(colAmt - 120, y, `Discount: -₹${money(aggregate.discountPaise)}`);
    y -= 16;
  }
  textAt(colAmt - 120, y, `Total: ₹${money(aggregate.total)}`);
  endText();

  // Terms (short)
  const terms = b.termsAndConditions?.trim() ?? '';
  if (terms) {
    y -= 22;
    setFont(fontH);
    textAt(marginX, y, 'Terms and Conditions');
    endText();
    y -= 16;
    setFont(fontSmall);
    const termsLines = terms.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);
    for (const t of termsLines) {
      textAt(marginX, y, t.length > 100 ? t.slice(0, 99) + '…' : t);
      y -= 12;
      if (y < 80) break;
    }
    endText();
  }

  // Footer
  const f = aggregate.footer;
  const footerLine1 = [f.address, f.email, f.phone].filter(Boolean).join(' · ');
  const footerLine2 = "It's a computer generated invoice, Signature not required.";
  setFont(fontSmall);
  textAt(marginX, 56, footerLine1 || '');
  textAt(marginX, 42, footerLine2);
  endText();

  const streamBody = contentParts.join('\n');
  const header = '%PDF-1.1\n';
  const obj1 = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n';
  const obj2 = '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n';
  const obj3 = '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >> endobj\n';
  const streamLen = Buffer.byteLength(streamBody, 'utf8');
  const obj4 = '4 0 obj << /Length ' + streamLen + ' >> stream\n' + streamBody + '\nendstream endobj\n';

  const parts = [header, obj1, obj2, obj3, obj4];
  let offset = 0;
  const offsets: number[] = [0];
  for (const p of parts) {
    offset += Buffer.byteLength(p, 'utf8');
    offsets.push(offset);
  }
  const xrefStart = offset;
  const xrefLines = [
    'xref',
    '0 5',
    '0000000000 65535 f ',
    String(offsets[1]).padStart(10) + ' 00000 n ',
    String(offsets[2]).padStart(10) + ' 00000 n ',
    String(offsets[3]).padStart(10) + ' 00000 n ',
    String(offsets[4]).padStart(10) + ' 00000 n ',
  ];
  const xref = xrefLines.join('\n') + '\n';
  const trailer = 'trailer << /Size 5 /Root 1 0 R >>\nstartxref\n' + String(xrefStart) + '\n%%EOF\n';
  const full = parts.join('') + xref + trailer;
  return Buffer.from(full, 'utf8');
}

export class SimplePdfGenerator implements PdfGenerator {
  async generateInvoicePdfBuffer(aggregate: InvoicePdfAggregate): Promise<Buffer> {
    return buildMinimalPdf(aggregate);
  }
}
