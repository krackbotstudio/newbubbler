/**
 * Minimum weight rule for wash services has been removed.
 * Orders with any weight (including < 3 kg) can be confirmed.
 */
import { ServiceType } from '@shared/enums';
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

const futureDate = new Date(Date.now() + 86400000 * 2);

const baseDeps = {
  ordersRepo: createFakeOrdersRepo(),
  subscriptionsRepo: createFakeSubscriptionsRepo(),
  subscriptionUsageRepo: createFakeSubscriptionUsageRepo(),
  unitOfWork: undefined,
  serviceAreaRepo: createFakeServiceAreaRepo(new Set(['500081'])),
  slotConfigRepo: createFakeSlotConfigRepo({
    slot: {
      id: 'slot-1',
      date: futureDate,
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

const baseParams = {
  userId: 'user-1',
  addressId: 'addr-1',
  pincode: '500081',
  pickupDate: futureDate,
  timeWindow: '10:00-12:00',
};

function makeDeps() {
  return {
    ...baseDeps,
    ordersRepo: createFakeOrdersRepo(),
  };
}

describe('Create order – no minimum weight rule', () => {
  it('succeeds when WASH_FOLD with estimatedWeightKg < 3', async () => {
    const deps = makeDeps();
    const result = await createOrder(
      {
        ...baseParams,
        serviceType: ServiceType.WASH_FOLD,
        estimatedWeightKg: 2.5,
      },
      deps,
    );
    expect(result.orderId).toBeDefined();
    expect(deps.ordersRepo.records).toHaveLength(1);
    expect(deps.ordersRepo.records[0].estimatedWeightKg).toBe(2.5);
  });

  it('succeeds when WASH_IRON with estimatedWeightKg 0', async () => {
    const deps = makeDeps();
    const result = await createOrder(
      {
        ...baseParams,
        serviceType: ServiceType.WASH_IRON,
        estimatedWeightKg: 0,
      },
      deps,
    );
    expect(result.orderId).toBeDefined();
    expect(deps.ordersRepo.records.some((r) => r.serviceType === ServiceType.WASH_IRON)).toBe(true);
  });

  it('succeeds when WASH_FOLD with estimatedWeightKg >= 3', async () => {
    const deps = makeDeps();
    const result = await createOrder(
      {
        ...baseParams,
        serviceType: ServiceType.WASH_FOLD,
        estimatedWeightKg: 3,
      },
      deps,
    );
    expect(result.orderId).toBeDefined();
    expect(deps.ordersRepo.records[0].estimatedWeightKg).toBe(3);
  });

  it('DRY_CLEAN does not require weight', async () => {
    const deps = makeDeps();
    const result = await createOrder(
      {
        ...baseParams,
        serviceType: ServiceType.DRY_CLEAN,
        estimatedWeightKg: undefined,
      },
      deps,
    );
    expect(result.orderId).toBeDefined();
    expect(deps.ordersRepo.records.some((r) => r.serviceType === ServiceType.DRY_CLEAN)).toBe(true);
  });
});
