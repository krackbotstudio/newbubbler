/**
 * Service area and slot capacity validations.
 *
 * - PINCODE_NOT_SERVICEABLE when pincode not active in ServiceArea.
 * - SLOT_NOT_AVAILABLE when slot config missing.
 * - SLOT_FULL when slot capacity reached.
 */
import { ServiceType } from '@shared/enums';
import { AppError, isAppError } from '../errors';
import { createOrder } from '../orders/create-order.use-case';
import {
  createFakeOrdersRepo,
  createFakeSubscriptionsRepo,
  createFakeSubscriptionUsageRepo,
  createFakeServiceAreaRepo,
  createFakeSlotConfigRepo,
  createFakeHolidaysRepo,
  createFakeOperatingHoursRepo,
} from './fakes/in-memory-repos';

const baseParams = {
  userId: 'user-1',
  addressId: 'addr-1',
  pickupDate: new Date(),
  timeWindow: '10:00-12:00',
  estimatedWeightKg: 3,
  subscriptionId: null as string | null,
};

describe('Service area and slot capacity validations', () => {
  it('throws PINCODE_NOT_SERVICEABLE when pincode is not active', async () => {
    const ordersRepo = createFakeOrdersRepo();
    const subscriptionsRepo = createFakeSubscriptionsRepo();
    const subscriptionUsageRepo = createFakeSubscriptionUsageRepo();
    const serviceAreaRepo = createFakeServiceAreaRepo(new Set()); // no pincodes serviceable
    const slotConfigRepo = createFakeSlotConfigRepo({
      slot: {
        id: 'slot-1',
        date: new Date(),
        timeWindow: '10:00-12:00',
        pincode: '500000',
        capacity: 10,
      },
      existingCount: 0,
    });

    let err: unknown;
    try {
      await createOrder(
        {
          ...baseParams,
          serviceType: ServiceType.WASH_FOLD,
          pincode: '500000',
        },
        {
          ordersRepo,
          subscriptionsRepo,
          subscriptionUsageRepo,
          unitOfWork: undefined,
          serviceAreaRepo,
          slotConfigRepo,
          holidaysRepo: createFakeHolidaysRepo(),
          operatingHoursRepo: createFakeOperatingHoursRepo(),
        },
      );
    } catch (e) {
      err = e;
    }
    expect(isAppError(err)).toBe(true);
    expect((err as AppError).code).toBe('PINCODE_NOT_SERVICEABLE');
  });

  it('throws SLOT_FULL when slot capacity is exceeded', async () => {
    const ordersRepo = createFakeOrdersRepo();
    const subscriptionsRepo = createFakeSubscriptionsRepo();
    const subscriptionUsageRepo = createFakeSubscriptionUsageRepo();
    const serviceAreaRepo = createFakeServiceAreaRepo(new Set(['500081']));
    const slotConfigRepo = createFakeSlotConfigRepo({
      slot: {
        id: 'slot-1',
        date: new Date(),
        timeWindow: '10:00-12:00',
        pincode: '500081',
        capacity: 1,
      },
      existingCount: 1,
    });

    let err: unknown;
    try {
      await createOrder(
        {
          ...baseParams,
          serviceType: ServiceType.WASH_FOLD,
          pincode: '500081',
        },
        {
          ordersRepo,
          subscriptionsRepo,
          subscriptionUsageRepo,
          unitOfWork: undefined,
          serviceAreaRepo,
          slotConfigRepo,
          holidaysRepo: createFakeHolidaysRepo(),
          operatingHoursRepo: createFakeOperatingHoursRepo(),
        },
      );
    } catch (e) {
      err = e;
    }
    expect(isAppError(err)).toBe(true);
    expect((err as AppError).code).toBe('SLOT_FULL');
  });

  it('throws SLOT_NOT_AVAILABLE when no slot exists for given time', async () => {
    const ordersRepo = createFakeOrdersRepo();
    const subscriptionsRepo = createFakeSubscriptionsRepo();
    const subscriptionUsageRepo = createFakeSubscriptionUsageRepo();
    const serviceAreaRepo = createFakeServiceAreaRepo(new Set(['500081']));
    const slotConfigRepo = createFakeSlotConfigRepo({
      slot: null,
      existingCount: 0,
    });

    let err: unknown;
    try {
      await createOrder(
        {
          ...baseParams,
          serviceType: ServiceType.WASH_FOLD,
          pincode: '500081',
        },
        {
          ordersRepo,
          subscriptionsRepo,
          subscriptionUsageRepo,
          unitOfWork: undefined,
          serviceAreaRepo,
          slotConfigRepo,
          holidaysRepo: createFakeHolidaysRepo(),
          operatingHoursRepo: createFakeOperatingHoursRepo(), // null = no auto-create
        },
      );
    } catch (e) {
      err = e;
    }
    expect(isAppError(err)).toBe(true);
    expect((err as AppError).code).toBe('SLOT_NOT_AVAILABLE');
  });
});

