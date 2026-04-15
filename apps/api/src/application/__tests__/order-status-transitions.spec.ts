/**
 * T4: Order status transition validation.
 * - Valid: BOOKING_CONFIRMED -> PICKUP_SCHEDULED -> PICKED_UP.
 * - Invalid: BOOKING_CONFIRMED -> DELIVERED throws INVALID_STATUS_TRANSITION.
 */
import { OrderStatus } from '@shared/enums';
import { AppError } from '../errors';
import { updateOrderStatus } from '../orders/update-order-status.use-case';
import { createFakeOrdersRepo, minimalTestOrderRecord } from './fakes/in-memory-repos';

describe('T4: Order status transition validation', () => {
  const orderId = 'order-1';

  it('allows BOOKING_CONFIRMED -> PICKUP_SCHEDULED', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.BOOKING_CONFIRMED,
      }),
    ]);
    const result = await updateOrderStatus(
      { orderId, toStatus: OrderStatus.PICKUP_SCHEDULED },
      { ordersRepo },
    );
    expect(result.status).toBe(OrderStatus.PICKUP_SCHEDULED);
    expect(ordersRepo.records[0].status).toBe(OrderStatus.PICKUP_SCHEDULED);
  });

  it('allows PICKUP_SCHEDULED -> PICKED_UP', async () => {
    const ordersRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: orderId,
        userId: 'user-1',
        status: OrderStatus.PICKUP_SCHEDULED,
      }),
    ]);
    const result = await updateOrderStatus(
      { orderId, toStatus: OrderStatus.PICKED_UP },
      { ordersRepo },
    );
    expect(result.status).toBe(OrderStatus.PICKED_UP);
  });

  it('throws INVALID_STATUS_TRANSITION for BOOKING_CONFIRMED -> DELIVERED', async () => {
    const freshRepo = createFakeOrdersRepo([
      minimalTestOrderRecord({
        id: 'ord-2',
        userId: 'user-1',
        status: OrderStatus.BOOKING_CONFIRMED,
      }),
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
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INVALID_STATUS_TRANSITION');
  });
});
