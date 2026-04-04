export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  branchId: string | null;
  addressId: string | null;
  validityStartDate: Date;
  remainingPickups: number;
  usedKg: number;
  usedItemsCount: number;
  expiryDate: Date;
  active: boolean;
  totalMaxPickups: number | null;
  totalKgLimit: number | null;
  totalItemsLimit: number | null;
}

export interface SubscriptionPlanLimits {
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
}

/** For customer /me: active subscription id only (legacy). */
export interface ActiveSubscriptionRecord {
  id: string;
}

/** For /me and admin: active subscription with plan and remaining limits. */
export interface ActiveSubscriptionWithPlanRecord extends ActiveSubscriptionRecord {
  planId: string;
  planName: string;
  addressId: string | null;
  /** Snapshot at purchase; still displayed after address is edited/deleted. */
  addressLabel: string | null;
  validityStartDate: Date;
  validTill: Date;
  remainingPickups: number;
  remainingKg: number | null;
  remainingItems: number | null;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  usedKg: number;
  usedItemsCount: number;
}

export interface CreateSubscriptionInput {
  userId: string;
  planId: string;
  branchId?: string | null;
  addressId?: string | null;
  /** Snapshot at purchase so address still displays after edit/delete. */
  addressLabel?: string | null;
  addressLine?: string | null;
  validityStartDate: Date;
  expiryDate: Date;
  remainingPickups: number;
  totalMaxPickups?: number | null;
  totalKgLimit?: number | null;
  totalItemsLimit?: number | null;
}

export interface SubscriptionsRepo {
  getById(id: string): Promise<SubscriptionRecord | null>;
  findActiveByUserId(userId: string): Promise<ActiveSubscriptionRecord | null>;
  /** All active subscriptions for user (multiple allowed). When branchId is provided, only returns subscriptions for that branch. */
  listActiveByUserId(userId: string, branchId?: string | null): Promise<ActiveSubscriptionWithPlanRecord[]>;
  findActiveWithPlanByUserId(userId: string): Promise<ActiveSubscriptionWithPlanRecord | null>;
  /** Active subscription for same plan (for extend). */
  findActiveByUserIdAndPlanId(userId: string, planId: string): Promise<SubscriptionRecord | null>;
  /** True if user has ever had any subscription for this plan (for single-use offer check). */
  hasEverRedeemedPlan(userId: string, planId: string): Promise<boolean>;
  /** Count subscriptions where active = true. */
  countActive(): Promise<number>;
  /** Active subscriptions tied to this branch (branchId on subscription row). */
  countActiveForBranch(branchId: string): Promise<number>;
  create(data: CreateSubscriptionInput): Promise<SubscriptionRecord>;
  /** Extend validity and limits by quantityMonths (add plan * quantity). */
  extendSubscription(
    subscriptionId: string,
    params: { quantityMonths: number; planMaxPickups: number; planValidityDays: number; planKgLimit: number | null; planItemsLimit: number | null },
  ): Promise<SubscriptionRecord>;
  updateRemainingPickups(
    subscriptionId: string,
    remainingPickups: number,
  ): Promise<SubscriptionRecord>;
  updateUsage(
    subscriptionId: string,
    data: { remainingPickups: number; usedKg: number; usedItemsCount: number },
  ): Promise<SubscriptionRecord>;
  setInactive(subscriptionId: string): Promise<SubscriptionRecord>;
  /** Past (inactive) subscriptions for customer profile (planName, resolved limits, maxPickups as per plan, inactivatedAt). When branchId is provided, only returns subscriptions for that branch. */
  listPastByUserId(userId: string, branchId?: string | null): Promise<(SubscriptionRecord & {
    planName: string;
    maxPickups: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    inactivatedAt: Date;
  })[]>;
  /** Per-user subscription counts: active and inactive. */
  getSubscriptionCountsByUserIds(userIds: string[]): Promise<Record<string, { active: number; inactive: number }>>;
}
