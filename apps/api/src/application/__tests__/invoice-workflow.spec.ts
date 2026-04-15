/**
 * Invoice workflow rules:
 * - FINAL invoice only when order.status === DELIVERED
 * - ACK invoice allowed from BOOKING_CONFIRMED onward (before or after pickup)
 */
import { OrderStatus, ServiceType } from '@shared/enums';
import { assertCanIssueFinalInvoice } from '../invoices/issue-final-invoice.use-case';
import { assertCanIssueAcknowledgementInvoice } from '../invoices/issue-ack-invoice.use-case';
import { createFakeOrdersRepo, minimalTestOrderRecord } from './fakes/in-memory-repos';

describe('Invoice workflow', () => {
  const orderId = 'ord-1';

  it('throws FINAL_INVOICE_NOT_ALLOWED when order is not DELIVERED', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.PICKED_UP,
        addressId: 'a1',
        serviceType: ServiceType.WASH_FOLD,
        serviceTypes: [ServiceType.WASH_FOLD],
        estimatedWeightKg: 5,
      }),
    ]);

    await expect(
      assertCanIssueFinalInvoice(orderId, { ordersRepo }),
    ).rejects.toMatchObject({
      code: 'FINAL_INVOICE_NOT_ALLOWED',
      message: expect.stringContaining('delivery'),
    });
  });

  it('does not throw when order is DELIVERED for final invoice', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.DELIVERED,
        addressId: 'a1',
        serviceType: ServiceType.WASH_FOLD,
        serviceTypes: [ServiceType.WASH_FOLD],
        estimatedWeightKg: 5,
      }),
    ]);

    await expect(
      assertCanIssueFinalInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when order is BOOKING_CONFIRMED for ACK invoice', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.BOOKING_CONFIRMED,
        addressId: 'a1',
        serviceType: ServiceType.WASH_FOLD,
        serviceTypes: [ServiceType.WASH_FOLD],
        estimatedWeightKg: 5,
      }),
    ]);

    await expect(
      assertCanIssueAcknowledgementInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when order is PICKED_UP for ACK invoice', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.PICKED_UP,
        addressId: 'a1',
        serviceType: ServiceType.WASH_FOLD,
        serviceTypes: [ServiceType.WASH_FOLD],
        estimatedWeightKg: 5,
      }),
    ]);

    await expect(
      assertCanIssueAcknowledgementInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });
});
