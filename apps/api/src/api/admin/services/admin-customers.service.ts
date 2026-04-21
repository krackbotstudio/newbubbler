import { Inject, Injectable } from '@nestjs/common';
import { searchCustomersByPhone } from '../../../application/customers/search-customers-by-phone.use-case';
import { getCustomer } from '../../../application/customers/get-customer.use-case';
import { updateCustomer } from '../../../application/customers/update-customer.use-case';
import type { UpdateCustomerPatch, CustomersRepo, PaymentsRepo, OrdersRepo, BranchRepo, ServiceAreaRepo, AddressesRepo } from '../../../application/ports';
import { CUSTOMERS_REPO, PAYMENTS_REPO, ORDERS_REPO, BRANCH_REPO, SERVICE_AREA_REPO, ADDRESSES_REPO } from '../../../infra/infra.module';

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
}

@Injectable()
export class AdminCustomersService {
  constructor(
    @Inject(CUSTOMERS_REPO)
    private readonly customersRepo: CustomersRepo,
    @Inject(PAYMENTS_REPO)
    private readonly paymentsRepo: PaymentsRepo,
    @Inject(ORDERS_REPO)
    private readonly ordersRepo: OrdersRepo,
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

  /** Phone search with order counts (same row shape as list). */
  async searchByPhoneWithCounts(phone: string, branchId?: string | null) {
    const customers = await searchCustomersByPhone(phone, { customersRepo: this.customersRepo }, branchId);
    if (customers.length === 0) return [];
    const userIds = customers.map((c) => c.id);
    const orderCounts = await this.ordersRepo.getOrderCountsByUserIds(userIds);
    return customers.map((c) => ({
      ...c,
      pastOrdersCount: orderCounts[c.id]?.past ?? 0,
      activeOrdersCount: orderCounts[c.id]?.active ?? 0,
    }));
  }

  /** List customers with order counts for admin list view. */
  async listWithCounts(limit: number, cursor?: string | null, search?: string | null, branchId?: string | null) {
    const { data, nextCursor } = await this.customersRepo.list(limit, cursor ?? null, search ?? null, branchId ?? null);
    const userIds = data.map((c) => c.id);
    const orderCounts = await this.ordersRepo.getOrderCountsByUserIds(userIds);
    const items = data.map((c) => ({
      ...c,
      pastOrdersCount: orderCounts[c.id]?.past ?? 0,
      activeOrdersCount: orderCounts[c.id]?.active ?? 0,
    }));
    return { data: items, nextCursor };
  }

  async countForDashboard(branchId?: string | null): Promise<{ totalCustomersCount: number }> {
    const totalCustomersCount = await this.ordersRepo.countDistinctCustomersWithPastOrActiveOrders(
      branchId ?? null,
    );
    return { totalCustomersCount };
  }

  async get(userId: string): Promise<AdminCustomerResponse> {
    const [customer, addressList] = await Promise.all([
      getCustomer(userId, { customersRepo: this.customersRepo }),
      this.addressesRepo.listByUserId(userId),
    ]);
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
    return { ...customer, addresses };
  }

  async update(userId: string, patch: UpdateCustomerPatch) {
    return updateCustomer(userId, patch, { customersRepo: this.customersRepo });
  }

  /** Previous payments (order only) for customer profile. When branchId is provided, only payments for orders in that branch are returned. */
  async getPayments(userId: string, branchId?: string | null) {
    const payments = await this.paymentsRepo.listByUserId(userId);
    let list = payments;
    if (branchId != null) {
      const adminOrdersResult = await this.ordersRepo.adminList({
        customerId: userId,
        branchId,
        limit: 2000,
      });
      const orderIdsInBranch = new Set(adminOrdersResult.data.map((o) => o.id));
      list = payments.filter((p) => p.orderId != null && orderIdsInBranch.has(p.orderId));
    }
    return this.enrichPaymentsWithBranch(list);
  }

  private async enrichPaymentsWithBranch(
    payments: Awaited<ReturnType<PaymentsRepo['listByUserId']>>,
  ): Promise<Array<{
    id: string;
    orderId: string | null;
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
    const orders = await Promise.all(orderIds.map((id) => this.ordersRepo.getById(id)));
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
    const branchIds = new Set<string>([...orderIdToBranchId.values()].filter((id): id is string => id != null));
    const branches = await Promise.all([...branchIds].map((id) => this.branchRepo.getById(id)));
    const branchIdToName = new Map<string, string>([...branchIds].map((id, i) => [id, branches[i]?.name ?? id]));
    return payments.map((p) => {
      const bid = p.orderId ? (orderIdToBranchId.get(p.orderId) ?? null) : null;
      const branchName = bid ? (branchIdToName.get(bid) ?? null) : null;
      return {
        id: p.id,
        orderId: p.orderId ?? null,
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
