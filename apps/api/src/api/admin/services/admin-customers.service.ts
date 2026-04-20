import { Inject, Injectable } from '@nestjs/common';
import { searchCustomersByPhone } from '../../../application/customers/search-customers-by-phone.use-case';
import { getCustomer } from '../../../application/customers/get-customer.use-case';
import { updateCustomer } from '../../../application/customers/update-customer.use-case';
import type { UpdateCustomerPatch, CustomersRepo, SubscriptionsRepo, PaymentsRepo, OrdersRepo, SubscriptionUsageRepo, BranchRepo, ServiceAreaRepo, AddressesRepo } from '../../../application/ports';
import { CUSTOMERS_REPO, SUBSCRIPTIONS_REPO, PAYMENTS_REPO, ORDERS_REPO, SUBSCRIPTION_USAGE_REPO, BRANCH_REPO, SERVICE_AREA_REPO, ADDRESSES_REPO } from '../../../infra/infra.module';

/** One subscription for customer profile (active or past). */
export interface CustomerSubscriptionSummary {
  id: string;
  planName: string;
  /** Resolved from subscription addressId and customer addresses. */
  addressLabel?: string | null;
  remainingPickups: number;
  usedKg: number;
  usedItemsCount: number;
  usedPickups: number;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  expiryDate: string;
  validityStartDate: string;
  active: boolean;
}

/** Saved address for admin customer profile. */
export interface AdminCustomerAddress {
  id: string;
  label: string;
  addressLine: string;
  pincode: string;
  isDefault: boolean;
  googleMapUrl?: string | null;
}

/** Customer record as returned by GET /admin/customers/:userId. */
export interface AdminCustomerResponse {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Saved addresses for this customer. */
  addresses: AdminCustomerAddress[];
  /** First active subscription (backward compat). */
  subscription?: CustomerSubscriptionSummary | null;
  /** All active subscriptions (multiple allowed). */
  activeSubscriptions: CustomerSubscriptionSummary[];
  /** Past (inactive) subscriptions for reference. */
  pastSubscriptions: CustomerSubscriptionSummary[];
}

@Injectable()
export class AdminCustomersService {
  constructor(
    @Inject(CUSTOMERS_REPO)
    private readonly customersRepo: CustomersRepo,
    @Inject(SUBSCRIPTIONS_REPO)
    private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(PAYMENTS_REPO)
    private readonly paymentsRepo: PaymentsRepo,
    @Inject(ORDERS_REPO)
    private readonly ordersRepo: OrdersRepo,
    @Inject(SUBSCRIPTION_USAGE_REPO)
    private readonly subscriptionUsageRepo: SubscriptionUsageRepo,
    @Inject(BRANCH_REPO)
    private readonly branchRepo: BranchRepo,
    @Inject(SERVICE_AREA_REPO)
    private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(ADDRESSES_REPO)
    private readonly addressesRepo: AddressesRepo,
  ) {}

  async searchByPhone(phone: string, branchId?: string | null) {
    return searchCustomersByPhone(phone, { customersRepo: this.customersRepo }, branchId);
  }

  /** Phone search with order/subscription counts (same row shape as list). */
  async searchByPhoneWithCounts(phone: string, branchId?: string | null) {
    const customers = await searchCustomersByPhone(phone, { customersRepo: this.customersRepo }, branchId);
    if (customers.length === 0) return [];
    const userIds = customers.map((c) => c.id);
    const [orderCounts, subCounts] = await Promise.all([
      this.ordersRepo.getOrderCountsByUserIds(userIds),
      this.subscriptionsRepo.getSubscriptionCountsByUserIds(userIds),
    ]);
    return customers.map((c) => ({
      ...c,
      pastOrdersCount: orderCounts[c.id]?.past ?? 0,
      activeOrdersCount: orderCounts[c.id]?.active ?? 0,
      activeSubscriptionsCount: subCounts[c.id]?.active ?? 0,
      inactiveSubscriptionsCount: subCounts[c.id]?.inactive ?? 0,
    }));
  }

  /** List customers with order and subscription counts for admin list view. */
  async listWithCounts(limit: number, cursor?: string | null, search?: string | null, branchId?: string | null) {
    const { data, nextCursor } = await this.customersRepo.list(limit, cursor ?? null, search ?? null, branchId ?? null);
    const userIds = data.map((c) => c.id);
    const [orderCounts, subCounts] = await Promise.all([
      this.ordersRepo.getOrderCountsByUserIds(userIds),
      this.subscriptionsRepo.getSubscriptionCountsByUserIds(userIds),
    ]);
    const items = data.map((c) => ({
      ...c,
      pastOrdersCount: orderCounts[c.id]?.past ?? 0,
      activeOrdersCount: orderCounts[c.id]?.active ?? 0,
      activeSubscriptionsCount: subCounts[c.id]?.active ?? 0,
      inactiveSubscriptionsCount: subCounts[c.id]?.inactive ?? 0,
    }));
    return { data: items, nextCursor };
  }

  async countForDashboard(branchId?: string | null): Promise<{ totalCustomersCount: number }> {
    const totalCustomersCount = await this.ordersRepo.countDistinctCustomersWithPastOrActiveOrders(
      branchId ?? null,
    );
    return { totalCustomersCount };
  }

  async get(userId: string, branchId?: string | null): Promise<AdminCustomerResponse> {
    const [customer, addressList, activeList] = await Promise.all([
      getCustomer(userId, { customersRepo: this.customersRepo }),
      this.addressesRepo.listByUserId(userId),
      this.subscriptionsRepo.listActiveByUserId(userId, branchId),
    ]);
    const pastList = await this.subscriptionsRepo.listPastByUserId(userId, branchId);
    const addressIdToLabel = new Map<string, string>(
      addressList.map((a) => [a.id, a.label?.trim() ?? a.id]),
    );
    const toSummary = (s: { id: string; planName: string; addressId?: string | null; remainingPickups: number; usedKg: number; usedItemsCount: number; maxPickups: number; kgLimit: number | null; itemsLimit: number | null; validTill: Date; validityStartDate?: Date }) => ({
      id: s.id,
      planName: s.planName,
      addressLabel: s.addressId ? (addressIdToLabel.get(s.addressId) ?? null) : null,
      remainingPickups: s.remainingPickups,
      usedKg: s.usedKg,
      usedItemsCount: s.usedItemsCount,
      usedPickups: s.maxPickups - s.remainingPickups,
      maxPickups: s.maxPickups,
      kgLimit: s.kgLimit,
      itemsLimit: s.itemsLimit,
      expiryDate: (s.validTill instanceof Date ? s.validTill : new Date(s.validTill)).toISOString(),
      validityStartDate: (s.validityStartDate instanceof Date ? s.validityStartDate : new Date()).toISOString(),
      active: true,
    });
    const activeSubscriptions = activeList.map((s) => toSummary({ ...s, validTill: s.validTill, validityStartDate: s.validityStartDate }));
    const pastSubscriptions = pastList.map((s) => {
      const maxPickups = s.maxPickups ?? s.totalMaxPickups ?? s.remainingPickups;
      const usedPickups = maxPickups - s.remainingPickups;
      return {
        id: s.id,
        planName: s.planName,
        addressLabel: s.addressId ? (addressIdToLabel.get(s.addressId) ?? null) : null,
        remainingPickups: s.remainingPickups,
        usedKg: s.usedKg,
        usedItemsCount: s.usedItemsCount,
        usedPickups,
        maxPickups,
        kgLimit: s.kgLimit ?? s.totalKgLimit,
        itemsLimit: s.itemsLimit ?? s.totalItemsLimit,
        expiryDate: s.expiryDate.toISOString(),
        validityStartDate: s.validityStartDate.toISOString(),
        inactivatedAt: s.inactivatedAt.toISOString(),
        active: false,
      };
    });
    const subscription = activeSubscriptions[0] ?? null;
    const addresses: AdminCustomerAddress[] = addressList
      .filter((a) => (a.label?.trim() ?? '').toLowerCase() !== 'walk-in')
      .map((a) => ({
        id: a.id,
        label: a.label,
        addressLine: a.addressLine,
        pincode: a.pincode,
        isDefault: a.isDefault,
        googleMapUrl: a.googleMapUrl ?? null,
      }));
    return { ...customer, addresses, subscription, activeSubscriptions, pastSubscriptions };
  }

  async update(userId: string, patch: UpdateCustomerPatch) {
    return updateCustomer(userId, patch, { customersRepo: this.customersRepo });
  }

  /** Order IDs per subscription (chronological) for customer subscription card chips. Uses order.subscriptionId and subscription_usage. When branchId is provided (e.g. Branch Head), only that branch's orders and subscriptions are returned. */
  async getSubscriptionOrders(userId: string, branchId?: string | null): Promise<{ subscriptionId: string; orderIds: string[] }[]> {
    const [activeList, pastList, orders] = await Promise.all([
      this.subscriptionsRepo.listActiveByUserId(userId, branchId),
      this.subscriptionsRepo.listPastByUserId(userId, branchId),
      this.ordersRepo.listByUser(userId, branchId),
    ]);
    const allSubs = [...activeList, ...pastList];
    const orderIdsSet = new Set(orders.map((o) => o.id));
    const orderByCreatedAt = new Map(orders.map((o) => [o.id, new Date(o.createdAt).getTime()]));

    const result: { subscriptionId: string; orderIds: string[] }[] = [];
    for (const sub of allSubs) {
      const fromOrders = orders
        .filter((o) => (o.subscriptionId ?? null) === sub.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((o) => o.id);
      const fromUsage = await this.subscriptionUsageRepo.listOrderIdsBySubscriptionId(sub.id);
      const fromUsageFiltered = fromUsage.filter((id) => orderIdsSet.has(id));
      const merged = [...new Set([...fromOrders, ...fromUsageFiltered])].sort(
        (a, b) => (orderByCreatedAt.get(a) ?? 0) - (orderByCreatedAt.get(b) ?? 0),
      );
      result.push({ subscriptionId: sub.id, orderIds: merged });
    }
    return result;
  }

  /** Previous payments (order + subscription) for customer profile. When branchId is provided (e.g. Branch Head or admin filter), only payments for orders/subscriptions in that branch are returned. Uses the same branch logic as the Order history table: orders with this branchId OR orders with no branchId but pincode in this branch's service area. Each row includes branchId and branchName for the Branch column. */
  async getPayments(userId: string, branchId?: string | null) {
    const payments = await this.paymentsRepo.listByUserId(userId);
    let list = payments;
    if (branchId != null) {
      const [adminOrdersResult, activeSubs, pastSubs] = await Promise.all([
        this.ordersRepo.adminList({
          customerId: userId,
          branchId,
          limit: 2000,
        }),
        this.subscriptionsRepo.listActiveByUserId(userId, branchId),
        this.subscriptionsRepo.listPastByUserId(userId, branchId),
      ]);
      const orderIdsInBranch = new Set(adminOrdersResult.data.map((o) => o.id));
      const subscriptionIdsInBranch = new Set([...activeSubs.map((s) => s.id), ...pastSubs.map((s) => s.id)]);
      list = payments.filter(
        (p) =>
          (p.orderId != null && orderIdsInBranch.has(p.orderId)) ||
          (p.subscriptionId != null && subscriptionIdsInBranch.has(p.subscriptionId)),
      );
    }
    return this.enrichPaymentsWithBranch(list);
  }

  private async enrichPaymentsWithBranch(
    payments: Awaited<ReturnType<PaymentsRepo['listByUserId']>>,
  ): Promise<Array<{
    id: string;
    orderId: string | null;
    subscriptionId: string | null;
    type: 'order' | 'subscription';
    amount: number;
    status: string;
    provider: string;
    failureReason: string | null;
    createdAt: Date;
    branchId: string | null;
    branchName: string | null;
  }>> {
    if (payments.length === 0) return [];
    const orderIds = [...new Set(payments.filter((p) => p.orderId).map((p) => p.orderId!))];
    const subIds = [...new Set(payments.filter((p) => p.subscriptionId).map((p) => p.subscriptionId!))];
    const [orders, subs] = await Promise.all([
      Promise.all(orderIds.map((id) => this.ordersRepo.getById(id))),
      Promise.all(subIds.map((id) => this.subscriptionsRepo.getById(id))),
    ]);
    const pincodesToResolve = orderIds
      .map((id, i) => (orders[i]?.branchId == null && orders[i]?.pincode ? { orderId: id, pincode: orders[i].pincode } : null))
      .filter((x): x is { orderId: string; pincode: string } => x != null);
    const serviceAreasByPincode = await Promise.all(
      pincodesToResolve.map(({ pincode }) => this.serviceAreaRepo.getByPincode(pincode)),
    );
    const pincodeToBranchId = new Map<string, string | null>(
      pincodesToResolve.map(({ pincode }, i) => [pincode, serviceAreasByPincode[i]?.branchId ?? null]),
    );
    const orderIdToBranchId = new Map<string, string | null>(
      orderIds.map((id, i) => {
        const order = orders[i];
        const bid = order?.branchId ?? null;
        if (bid != null) return [id, bid] as const;
        const fromPincode = order?.pincode ? pincodeToBranchId.get(order.pincode) ?? null : null;
        return [id, fromPincode] as const;
      }),
    );
    const subIdToBranchId = new Map<string, string | null>(subIds.map((id, i) => [id, subs[i]?.branchId ?? null]));
    const branchIds = new Set<string>([
      ...orderIdToBranchId.values(),
      ...subIdToBranchId.values(),
    ].filter((id): id is string => id != null));
    const branches = await Promise.all([...branchIds].map((id) => this.branchRepo.getById(id)));
    const branchIdToName = new Map<string, string>([...branchIds].map((id, i) => [id, branches[i]?.name ?? id]));
    return payments.map((p) => {
      const bid = p.orderId
        ? orderIdToBranchId.get(p.orderId) ?? null
        : p.subscriptionId
          ? subIdToBranchId.get(p.subscriptionId) ?? null
          : null;
      const branchName = bid ? (branchIdToName.get(bid) ?? null) : null;
      return {
        id: p.id,
        orderId: p.orderId ?? null,
        subscriptionId: p.subscriptionId ?? null,
        type: (p.subscriptionId ? 'subscription' : 'order') as 'order' | 'subscription',
        amount: p.amount,
        status: p.status,
        provider: p.provider,
        failureReason: p.failureReason ?? null,
        createdAt: p.createdAt,
        branchId: bid ?? null,
        branchName: branchName ?? null,
      };
    });
  }
}
