/**
 * T2: Subscription linked at order creation; deduction happens at ACK (not here).
 * - Active subscription with remainingPickups=2, expiry in future.
 * - createOrder with subscriptionId and estimatedWeightKg >= 3.
 * - Order created with subscriptionId; remainingPickups unchanged; no SubscriptionUsage yet.
 */
import { OrderType, ServiceType } from '@shared/enums';
import { createOrder } from '../orders/create-order.use-case';
import {
  createFakeAddressesRepo,
  createFakeOrdersRepo,
  createFakeSubscriptionsRepo,
  createFakeSubscriptionUsageRepo,
  createFakeServiceAreaRepo,
  createFakeSlotConfigRepo,
  createFakeHolidaysRepo,
  createFakeOperatingHoursRepo,
} from './fakes/in-memory-repos';

describe('T2: Subscription eligibility at order creation (no deduction)', () => {
  const pickupDate = new Date(Date.now() + 86400000);
  const ordersRepo = createFakeOrdersRepo();
  const subscription = {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-1',
    remainingPickups: 2,
    usedKg: 0,
    usedItemsCount: 0,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    active: true,
    addressId: 'addr-1',
    branchId: 'branch-1',
  };
  const subscriptionsRepo = createFakeSubscriptionsRepo([subscription]);
  const subscriptionUsageRepo = createFakeSubscriptionUsageRepo();
  const deps = {
    ordersRepo,
    subscriptionsRepo,
    subscriptionUsageRepo,
    unitOfWork: undefined,
    serviceAreaRepo: createFakeServiceAreaRepo(new Set(['500081'])),
    slotConfigRepo: createFakeSlotConfigRepo({
      slot: {
        id: 'slot-1',
        date: pickupDate,
        timeWindow: '10:00-12:00',
        pincode: '500081',
        capacity: 10,
      },
      existingCount: 0,
    }),
    holidaysRepo: createFakeHolidaysRepo(),
    operatingHoursRepo: createFakeOperatingHoursRepo(),
    addressesRepo: createFakeAddressesRepo(),
  };

  it('creates order with subscriptionId and does not deduct (deduction at ACK)', async () => {
    const result = await createOrder(
      {
        userId: 'user-1',
        orderType: OrderType.SUBSCRIPTION,
        serviceType: ServiceType.WASH_FOLD,
        addressId: 'addr-1',
        pincode: '500081',
        pickupDate,
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 4,
        subscriptionId: 'sub-1',
      },
      deps,
    );

    expect(result.orderId).toBeDefined();
    const order = ordersRepo.records.find((r) => r.id === result.orderId);
    expect(order).toBeDefined();
    expect(order!.subscriptionId).toBe('sub-1');

    const subAfter = subscriptionsRepo.records.find((s) => s.id === 'sub-1');
    expect(subAfter!.remainingPickups).toBe(2);

    const usage = subscriptionUsageRepo.records.find((u) => u.orderId === result.orderId);
    expect(usage).toBeUndefined();
  });
});
