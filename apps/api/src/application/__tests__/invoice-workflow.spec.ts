/**
 * Invoice workflow rules:
 * - FINAL invoice only when order.status === DELIVERED
 * - ACK invoice allowed from BOOKING_CONFIRMED onward (before or after pickup)
 */
import { OrderStatus } from '@shared/enums';
import { assertCanIssueFinalInvoice } from '../invoices/issue-final-invoice.use-case';
import { assertCanIssueAcknowledgementInvoice } from '../invoices/issue-ack-invoice.use-case';
import { createFakeOrdersRepo } from './fakes/in-memory-repos';

describe('Invoice workflow', () => {
  const orderId = 'ord-1';

  it('throws FINAL_INVOICE_NOT_ALLOWED when order is not DELIVERED', async () => {
    const ordersRepo = createFakeOrdersRepo([
      {
        id: orderId,
        userId: 'u1',
        serviceType: 'WASH_FOLD' as any,
        serviceTypes: ['WASH_FOLD'],
        addressId: 'a1',
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 5,
        actualWeightKg: null,
        status: OrderStatus.PICKED_UP,
        subscriptionId: null,
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null,
        pickedUpAt: null,
        inProgressAt: null,
        readyAt: null,
        outForDeliveryAt: null,
        deliveredAt: null,
      },
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
      {
        id: orderId,
        userId: 'u1',
        serviceType: 'WASH_FOLD' as any,
        serviceTypes: ['WASH_FOLD'],
        addressId: 'a1',
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 5,
        actualWeightKg: null,
        status: OrderStatus.DELIVERED,
        subscriptionId: null,
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null,
        pickedUpAt: null,
        inProgressAt: null,
        readyAt: null,
        outForDeliveryAt: null,
        deliveredAt: null,
      },
    ]);

    await expect(
      assertCanIssueFinalInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when order is BOOKING_CONFIRMED for ACK invoice', async () => {
    const ordersRepo = createFakeOrdersRepo([
      {
        id: orderId,
        userId: 'u1',
        serviceType: 'WASH_FOLD' as any,
        serviceTypes: ['WASH_FOLD'],
        addressId: 'a1',
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 5,
        actualWeightKg: null,
        status: OrderStatus.BOOKING_CONFIRMED,
        subscriptionId: null,
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null,
        pickedUpAt: null,
        inProgressAt: null,
        readyAt: null,
        outForDeliveryAt: null,
        deliveredAt: null,
      },
    ]);

    await expect(
      assertCanIssueAcknowledgementInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when order is PICKED_UP for ACK invoice', async () => {
    const ordersRepo = createFakeOrdersRepo([
      {
        id: orderId,
        userId: 'u1',
        serviceType: 'WASH_FOLD' as any,
        serviceTypes: ['WASH_FOLD'],
        addressId: 'a1',
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 5,
        actualWeightKg: null,
        status: OrderStatus.PICKED_UP,
        subscriptionId: null,
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null,
        pickedUpAt: null,
        inProgressAt: null,
        readyAt: null,
        outForDeliveryAt: null,
        deliveredAt: null,
      },
    ]);

    await expect(
      assertCanIssueAcknowledgementInvoice(orderId, { ordersRepo }),
    ).resolves.toBeUndefined();
  });
});
