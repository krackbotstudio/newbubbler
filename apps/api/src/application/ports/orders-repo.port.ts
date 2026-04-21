import type { OrderStatus, OrderType } from '@shared/enums';
import type { ServiceType } from '@shared/enums';

export interface OrderRecord {
  id: string;
  userId: string;
  orderType: OrderType;
  /** When set to WALK_IN, order is from walk-in counter. */
  orderSource: string | null;
  serviceType: ServiceType;
  serviceTypes: ServiceType[];
  addressId: string;
  /** Address label at order time; shown even after address is edited/deleted. */
  addressLabel: string | null;
  /** Full address line at order time; shown even after address is edited/deleted. */
  addressLine: string | null;
  pincode: string;
  pickupDate: Date;
  timeWindow: string;
  estimatedWeightKg: number | null;
  actualWeightKg: number | null;
  status: OrderStatus;
  subscriptionId: string | null;
  branchId: string | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  pickedUpAt: Date | null;
  inProgressAt: Date | null;
  readyAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancellationReason?: string | null;
  cancelledAt?: Date | null;
}

export interface CreateOrderInput {
  userId: string;
  orderType: OrderType;
  serviceType: ServiceType;
  serviceTypes: ServiceType[];
  addressId: string;
  /** Address label at order time (stored so it doesn't change if user edits/deletes address). */
  addressLabel?: string | null;
  /** Full address line at order time (stored so it doesn't change if user edits/deletes address). */
  addressLine?: string | null;
  pincode: string;
  pickupDate: Date;
  timeWindow: string;
  estimatedWeightKg?: number | null;
  subscriptionId?: string | null;
  /** For walk-in orders. */
  branchId?: string | null;
  orderSource?: string | null;
}

export interface AdminOrdersFilters {
  status?: OrderStatus;
  pincode?: string;
  serviceType?: ServiceType;
  customerId?: string;
  branchId?: string | null;
  /** e.g. WALK_IN to show only walk-in orders. */
  orderSource?: string | null;
  /** Matches order id, customer name, or phone (partial; phone also matches digit-only substring). */
  search?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
  /** When set with pickupDateTo, filter by pickupDate only (for dashboard scheduled pickups). */
  pickupDateFrom?: Date;
  pickupDateTo?: Date;
  limit: number;
  cursor?: string;
}

/** One row in the admin orders list: order + customer/address/branch and display totals. */
export interface AdminOrderListRow extends OrderRecord {
  customerName: string | null;
  customerAddress: string;
  branchName: string | null;
  deliveredDate: Date | null;
  /** Amount to collect (paise): final invoice total when issued (with discount); else ACK total; else null. */
  billTotalPaise: number | null;
  /** Subtotal used for the shown bill (paise), based on FINAL (when issued) else ACK. */
  billSubtotalPaise: number | null;
  /** Tax used for the shown bill (paise), based on FINAL (when issued) else ACK. */
  billTaxPaise: number | null;
  /** Discount used for the shown bill (paise), based on FINAL (when issued) else ACK. */
  billDiscountPaise: number | null;
  /** Invoice/bill type for display: Individual, Subscription, Zero, Both. */
  billTypeLabel: string;
  /** When ACK invoice was issued (if any). */
  ackIssuedAt: Date | null;
  /** When Final invoice was issued (if any). */
  finalIssuedAt: Date | null;
  /** Payment failure reason (if payment status FAILED). */
  paymentFailureReason: string | null;
}

export interface AdminOrdersResult {
  data: AdminOrderListRow[];
  nextCursor: string | null;
}

/** For Admin Web: order + customer + address + branch + items + subscription + invoices + payment. */
export interface OrderAdminSummary {
  order: OrderRecord;
  customer: { id: string; name: string | null; phone: string | null; email: string | null };
  address: { id: string; label: string; addressLine: string; pincode: string; googleMapUrl?: string | null };
  /** Branch (from order.branchId, e.g. resolved by pincode when order was created). Includes branch id for catalog filtering and invoice info (address/phone/GST/PAN/footer note). */
  branch: {
    id: string;
    name: string;
    address: string;
    phone?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    footerNote?: string | null;
    invoicePrefix?: string | null;
    itemTagBrandName?: string | null;
    logoUrl?: string | null;
    updatedAt?: Date;
  } | null;
  orderItems: Array<{
    id: string;
    name?: string;
    serviceType: string;
    quantity: number;
    estimatedWeightKg: number | null;
    actualWeightKg: number | null;
    unitPricePaise: number | null;
    amountPaise: number | null;
  }>;
  subscription: { id: string; planName: string; remainingPickups: number; maxPickups: number; usedKg: number; usedItemsCount: number; kgLimit: number | null; itemsLimit: number | null; expiryDate: Date; active: boolean } | null;
  /** All active subscriptions for the customer (order.userId); for multi-select on ACK. */
  activeSubscriptions: Array<{ id: string; planName: string; remainingPickups: number; maxPickups: number; usedKg: number; usedItemsCount: number; kgLimit: number | null; itemsLimit: number | null; expiryDate: Date }>;
  subscriptionUsage: { deductedPickups: number; deductedKg: number; deductedItemsCount: number } | null;
  invoices: Array<{
    id: string;
    type: string;
    status: string;
    code: string | null;
    subtotal: number;
    tax: number;
    discountPaise: number | null;
    total: number;
    orderMode?: string;
    comments: string | null;
    issuedAt: Date | null;
    pdfUrl: string | null;
    subscriptionUsageKg?: number | null;
    subscriptionUsageItems?: number | null;
    /** Branding snapshot stored with this invoice (logo, address, PAN, GST, etc.) so any user sees same company branding. */
    brandingSnapshotJson?: unknown;
    items?: Array<{
      type: string;
      name: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      catalogItemId?: string | null;
      segmentCategoryId?: string | null;
      serviceCategoryId?: string | null;
      segmentLabel?: string | null;
      serviceLabel?: string | null;
    }>;
  }>;
  payment: {
    id: string;
    provider: string;
    status: string;
    amount: number;
    note?: string | null;
    createdAt: Date;
  } | null;
}

export interface OrdersRepo {
  create(data: CreateOrderInput): Promise<OrderRecord>;
  getById(id: string): Promise<OrderRecord | null>;
  /** Permanently delete order and related records. */
  deleteById(id: string): Promise<void>;
  /** Returns an order for this subscription that is not yet delivered or cancelled (if any). */
  findActiveBySubscriptionId(subscriptionId: string): Promise<OrderRecord | null>;
  /** All orders linked to this subscription (chronological). */
  listBySubscriptionId(subscriptionId: string): Promise<OrderRecord[]>;
  updateStatus(orderId: string, status: OrderStatus, options?: { cancellationReason?: string | null }): Promise<OrderRecord>;
  updatePaymentStatus(orderId: string, paymentStatus: string): Promise<OrderRecord>;
  /** Link order to subscription (e.g. when new subscription is created at ACK issue). */
  updateSubscriptionId(orderId: string, subscriptionId: string): Promise<OrderRecord>;
  /** When branchId is provided, only returns orders for that branch (e.g. for Branch Head scoping). */
  listByUser(userId: string, branchId?: string | null): Promise<OrderRecord[]>;
  /** Orders for customer with amountToPayPaise and subscription utilisation from invoice. */
  listByUserForCustomer(userId: string): Promise<Array<OrderRecord & {
    amountToPayPaise: number | null;
    subscriptionUsageKg: number | null;
    subscriptionUsageItems: number | null;
  }>>;
  /** Count orders for user with createdAt <= given date (for invoice number order sequence). */
  countByUserCreatedBefore(userId: string, createdAt: Date): Promise<number>;
  /** Per-user order counts: past (DELIVERED/CANCELLED), active (all other statuses). */
  getOrderCountsByUserIds(userIds: string[]): Promise<Record<string, { past: number; active: number }>>;
  /** Distinct customers with at least one past/active order (non-cancelled), optionally scoped by branch. */
  countDistinctCustomersWithPastOrActiveOrders(branchId?: string | null): Promise<number>;
  adminList(filters: AdminOrdersFilters): Promise<AdminOrdersResult>;
  getAdminSummary(orderId: string): Promise<OrderAdminSummary | null>;
}
