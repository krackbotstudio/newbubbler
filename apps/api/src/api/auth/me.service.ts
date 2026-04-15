import { Inject, Injectable } from '@nestjs/common';
import { ADDRESSES_REPO, CUSTOMERS_REPO, ORDERS_REPO, SUBSCRIPTIONS_REPO, SUBSCRIPTION_PLANS_REPO } from '../../infra/infra.module';
import type { AddressesRepo, CustomersRepo, OrdersRepo, SubscriptionsRepo, SubscriptionPlansRepo } from '../../application/ports';
import type { AuthUser } from '../common/roles.guard';

export interface RegisterPushTokenResult {
  ok: boolean;
}

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
  /** All active subscriptions (customer picks one when booking). Each is tied to one address (addressId). */
  activeSubscriptions: Array<{
    id: string;
    planId: string;
    planName: string;
    planDescription: string | null;
    /** Address this subscription is tied to (pickup/delivery only at this address). */
    addressId: string | null;
    /** Address label at purchase; still shown after address is edited/deleted. */
    addressLabel: string | null;
    validityStartDate: string;
    validTill: string;
    remainingPickups: number;
    remainingKg: number | null;
    remainingItems: number | null;
    maxPickups: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    /** Branch tied to this subscription (pickup slots and orders). */
    branchId: string | null;
    /** True when this subscription already has an order that is not yet delivered/cancelled. */
    hasActiveOrder: boolean;
  }>;
  /** First active subscription (backward compat). */
  activeSubscription?: {
    id: string;
    planId: string;
    planName: string;
    planDescription?: string | null;
    addressId?: string | null;
    validityStartDate: string;
    validTill: string;
    remainingPickups: number;
    remainingKg: number | null;
    remainingItems: number | null;
    maxPickups: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    hasActiveOrder?: boolean;
  };
  /** Past (completed) subscriptions for this customer. */
  pastSubscriptions?: Array<{
    id: string;
    planId: string;
    planName: string;
    addressId: string | null;
    /** Address label at purchase; still shown after address is edited/deleted. */
    addressLabel: string | null;
    validityStartDate: string;
    validTill: string;
    inactivatedAt: string;
    remainingPickups: number;
    usedPickups: number;
    maxPickups: number;
    usedKg: number;
    usedItemsCount: number;
    kgLimit: number | null;
    itemsLimit: number | null;
  }>;
}

@Injectable()
export class MeService {
  constructor(
    @Inject(ADDRESSES_REPO) private readonly addressesRepo: AddressesRepo,
    @Inject(SUBSCRIPTIONS_REPO) private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(SUBSCRIPTION_PLANS_REPO) private readonly subscriptionPlansRepo: SubscriptionPlansRepo,
    @Inject(CUSTOMERS_REPO) private readonly customersRepo: CustomersRepo,
    @Inject(ORDERS_REPO) private readonly ordersRepo: OrdersRepo,
  ) {}

  async getMe(user: AuthUser): Promise<MeResponse> {
    const [customer, defaultAddress, activeSubscriptionsList, pastSubscriptionsList] = await Promise.all([
      this.customersRepo.getById(user.id),
      this.addressesRepo.findDefaultByUserId(user.id),
      this.subscriptionsRepo.listActiveByUserId(user.id),
      this.subscriptionsRepo.listPastByUserId(user.id),
    ]);
    const activeSubscriptions = await Promise.all(
      activeSubscriptionsList.map(async (s) => {
        const [activeOrder, plan] = await Promise.all([
          this.ordersRepo.findActiveBySubscriptionId(s.id),
          this.subscriptionPlansRepo.getById(s.planId),
        ]);
        return {
          id: s.id,
          planId: s.planId,
          planName: s.planName,
          planDescription: plan?.description ?? null,
          branchId: s.branchId ?? null,
          addressId: s.addressId ?? null,
          addressLabel: s.addressLabel ?? null,
          validityStartDate: s.validityStartDate.toISOString(),
          validTill: s.validTill.toISOString(),
          remainingPickups: s.remainingPickups,
          remainingKg: s.remainingKg,
          remainingItems: s.remainingItems,
          maxPickups: s.maxPickups,
          kgLimit: s.kgLimit,
          itemsLimit: s.itemsLimit,
          hasActiveOrder: activeOrder != null,
        };
      }),
    );
    const pastSubscriptions = pastSubscriptionsList.map((s) => {
      const maxPickups = s.maxPickups;
      const usedPickups = maxPickups - s.remainingPickups;
      return {
        id: s.id,
        planId: s.planId,
        planName: s.planName,
        addressId: s.addressId ?? null,
        addressLabel: (s as { addressLabel?: string | null }).addressLabel ?? null,
        validityStartDate: s.validityStartDate.toISOString(),
        validTill: s.expiryDate.toISOString(),
        inactivatedAt: s.inactivatedAt.toISOString(),
        remainingPickups: s.remainingPickups,
        usedPickups,
        maxPickups,
        usedKg: s.usedKg,
        usedItemsCount: s.usedItemsCount,
        kgLimit: s.kgLimit,
        itemsLimit: s.itemsLimit,
      };
    });

    return {
      user: {
        id: user.id,
        phone: user.phone ?? null,
        role: user.role,
        name: customer?.name ?? null,
        email: customer?.email ?? null,
      },
      ...(defaultAddress && { defaultAddress: { id: defaultAddress.id, pincode: defaultAddress.pincode } }),
      activeSubscriptions,
      ...(activeSubscriptions[0] && { activeSubscription: activeSubscriptions[0] }),
      ...(pastSubscriptions.length > 0 && { pastSubscriptions }),
    };
  }

  async updateMe(user: AuthUser, patch: { name?: string | null; email?: string | null }) {
    return this.customersRepo.update(user.id, patch);
  }

  async registerPushToken(user: AuthUser, pushToken: string): Promise<RegisterPushTokenResult> {
    await this.customersRepo.update(user.id, { expoPushToken: pushToken });
    return { ok: true };
  }
}
