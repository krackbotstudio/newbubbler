/**
 * Subscription blocks further usage when ANY limit is reached:
 * expiry, remainingPickups, kgLimit, itemsLimit.
 */
import { AppError } from '../errors';
import { assertSubscriptionDeductionAllowed } from '../subscriptions/subscription-deduct-assert.use-case';
import type { SubscriptionRecord, SubscriptionPlanLimits } from '../ports';

describe('Subscription limits', () => {
  const baseSubscription: SubscriptionRecord = {
    id: 'sub-1',
    userId: 'u1',
    planId: 'plan-1',
    branchId: null,
    addressId: null,
    validityStartDate: new Date(),
    remainingPickups: 2,
    usedKg: 0,
    usedItemsCount: 0,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    active: true,
    totalMaxPickups: null,
    totalKgLimit: null,
    totalItemsLimit: null,
  };

  const planWithLimits: SubscriptionPlanLimits = {
    maxPickups: 2,
    kgLimit: 10,
    itemsLimit: 20,
  };

  it('allows deduction when within all limits', () => {
    expect(() =>
      assertSubscriptionDeductionAllowed(baseSubscription, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 3,
        deductedItemsCount: 5,
      }),
    ).not.toThrow();
  });

  it('allows deduction when remaining pickups becomes exactly 0 after', () => {
    const sub = { ...baseSubscription, remainingPickups: 1 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 0,
      }),
    ).not.toThrow();
  });

  it('allows deduction when remaining kg becomes exactly 0 after', () => {
    const sub = { ...baseSubscription, usedKg: 8 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 2,
        deductedItemsCount: 0,
      }),
    ).not.toThrow();
  });

  it('allows deduction when remaining items becomes exactly 0 after', () => {
    const sub = { ...baseSubscription, usedItemsCount: 18 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 2,
      }),
    ).not.toThrow();
  });

  it('throws NO_REMAINING_PICKUPS when pickups exhausted', () => {
    const sub = { ...baseSubscription, remainingPickups: 0 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 0,
      }),
    ).toThrow(AppError);
    try {
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 0,
      });
    } catch (e) {
      expect((e as AppError).code).toBe('NO_REMAINING_PICKUPS');
    }
  });

  it('throws EXCEEDED_LIMIT when kg limit would be exceeded', () => {
    const sub = { ...baseSubscription, usedKg: 9 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 2,
        deductedItemsCount: 0,
      }),
    ).toThrow(AppError);
    try {
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 2,
        deductedItemsCount: 0,
      });
    } catch (e) {
      expect((e as AppError).code).toBe('EXCEEDED_LIMIT');
      expect((e as AppError).message).toMatch(/kg limit/);
    }
  });

  it('throws EXCEEDED_LIMIT when items limit would be exceeded', () => {
    const sub = { ...baseSubscription, usedItemsCount: 19 };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 2,
      }),
    ).toThrow(AppError);
    try {
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 2,
      });
    } catch (e) {
      expect((e as AppError).code).toBe('EXCEEDED_LIMIT');
      expect((e as AppError).message).toMatch(/items limit/);
    }
  });

  it('throws SUBSCRIPTION_EXPIRED when subscription expired', () => {
    const sub = {
      ...baseSubscription,
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    expect(() =>
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 0,
      }),
    ).toThrow(AppError);
    try {
      assertSubscriptionDeductionAllowed(sub, planWithLimits, {
        deductedPickups: 1,
        deductedKg: 0,
        deductedItemsCount: 0,
      });
    } catch (e) {
      expect((e as AppError).code).toBe('SUBSCRIPTION_EXPIRED');
    }
  });

  it('allows when plan has null kgLimit and itemsLimit', () => {
    const planNoKgItems: SubscriptionPlanLimits = {
      maxPickups: 2,
      kgLimit: null,
      itemsLimit: null,
    };
    expect(() =>
      assertSubscriptionDeductionAllowed(baseSubscription, planNoKgItems, {
        deductedPickups: 1,
        deductedKg: 100,
        deductedItemsCount: 100,
      }),
    ).not.toThrow();
  });
});
