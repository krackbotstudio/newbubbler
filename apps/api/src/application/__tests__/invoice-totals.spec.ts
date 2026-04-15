/**
 * T5: Invoice totals calculation (pure function).
 * - SERVICE qty 1 unitPrice 1000 amount 1000; FEE qty 1 unitPrice 200 amount 200; DISCOUNT amount -100.
 * - subtotal, tax(=0), total correct. amount = quantity * unitPrice for non-discount (validate or compute).
 */
import { InvoiceItemType } from '@shared/enums';
import { calculateInvoiceTotals } from '../invoices/calculate-invoice-totals';

describe('T5: Invoice totals calculation', () => {
  it('computes subtotal and total correctly with SERVICE + FEE + DISCOUNT', () => {
    const items = [
      { type: InvoiceItemType.SERVICE, name: 'Wash & Fold', quantity: 1, unitPrice: 1000 },
      { type: InvoiceItemType.FEE, name: 'Pickup fee', quantity: 1, unitPrice: 200 },
      { type: InvoiceItemType.DISCOUNT, name: 'Promo', quantity: 1, unitPrice: -100 },
    ];
    const result = calculateInvoiceTotals(items, 0);

    expect(result.subtotal).toBe(1000 + 200 + (-100));
    expect(result.subtotal).toBe(1100);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(1100);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].amount).toBe(1000);
    expect(result.items[1].amount).toBe(200);
    expect(result.items[2].amount).toBe(-100);
  });

  it('computes amount as quantity * unitPrice when amount not provided', () => {
    const items = [
      { type: InvoiceItemType.SERVICE, name: 'Wash', quantity: 2, unitPrice: 500 },
    ];
    const result = calculateInvoiceTotals(items, 0);
    expect(result.items[0].amount).toBe(1000);
    expect(result.subtotal).toBe(1000);
    expect(result.total).toBe(1000);
  });

  it('uses explicit amount when provided', () => {
    const items = [
      { type: InvoiceItemType.FEE, name: 'Fee', quantity: 1, unitPrice: 100, amount: 150 },
    ];
    const result = calculateInvoiceTotals(items, 0);
    expect(result.items[0].amount).toBe(150);
    expect(result.subtotal).toBe(150);
  });

  it('adds tax to total when taxPaise provided', () => {
    const items = [
      { type: InvoiceItemType.SERVICE, name: 'S', quantity: 1, unitPrice: 1000 },
    ];
    const result = calculateInvoiceTotals(items, 100);
    expect(result.subtotal).toBe(1000);
    expect(result.tax).toBe(100);
    expect(result.total).toBe(1100);
  });
});
