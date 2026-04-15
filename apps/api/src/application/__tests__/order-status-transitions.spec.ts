/**
 * T4: Order status transition validation.
 * - Valid: BOOKING_CONFIRMED -> PICKUP_SCHEDULED -> PICKED_UP.
 * - Invalid: BOOKING_CONFIRMED -> DELIVERED throws INVALID_STATUS_TRANSITION.
 */
import { OrderStatus } from '@shared/enums';
import { AppError } from '../errors';
import { updateOrderStatus } from '../orders/update-order-status.use-case';
import { createFakeOrdersRepo } from './fakes/in-memory-repos';

describe('T4: Order status transition validation', () => {
  const orderId = 'order-1';
  const ordersRepo = createFakeOrdersRepo([
    {
      id: orderId,
      userId: 'user-1',
      serviceType: 'WASH_FOLD' as any,
      addressId: 'addr-1',
      pincode: '500081',
      pickupDate: new Date(),
      timeWindow: '10:00-12:00',
      estimatedWeightKg: 4,
      actualWeightKg: null,
      status: OrderStatus.BOOKING_CONFIRMED,
      subscriptionId: null,
      paymentStatus: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const deps = { ordersRepo };

  it('allows BOOKING_CONFIRMED -> PICKUP_SCHEDULED', async () => {
    const result = await updateOrderStatus(
      { orderId, toStatus: OrderStatus.PICKUP_SCHEDULED },
      deps,
    );
    expect(result.status).toBe(OrderStatus.PICKUP_SCHEDULED);
    expect(ordersRepo.records[0].status).toBe(OrderStatus.PICKUP_SCHEDULED);
  });

  it('allows PICKUP_SCHEDULED -> PICKED_UP', async () => {
    await updateOrderStatus(
      { orderId, toStatus: OrderStatus.PICKUP_SCHEDULED },
      deps,
    );
    const result = await updateOrderStatus(
      { orderId, toStatus: OrderStatus.PICKED_UP },
      deps,
    );
    expect(result.status).toBe(OrderStatus.PICKED_UP);
  });

  it('throws INVALID_STATUS_TRANSITION for BOOKING_CONFIRMED -> DELIVERED', async () => {
    const freshRepo = createFakeOrdersRepo([
      {
        id: 'ord-2',
        userId: 'user-1',
        serviceType: 'WASH_FOLD' as any,
        addressId: 'addr-1',
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 4,
        actualWeightKg: null,
        status: OrderStatus.BOOKING_CONFIRMED,
        subscriptionId: null,
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    let err: unknown;
    try {
      await updateOrderStatus(
        { orderId: 'ord-2', toStatus: OrderStatus.DELIVERED },
        { ordersRepo: freshRepo },
      );
    } catch (e) {
      err = e;
    }
    expect(err instanceof AppError).toBe(true);
    expect((err as AppError).code).toBe('INVALID_STATUS_TRANSITION');
    expect((err as AppError).message).toMatch(/not allowed/);
  });
});
