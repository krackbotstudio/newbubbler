/** Branding snapshot stored with an invoice so any user sees the same company logo, address, PAN, GST. */
export interface InvoiceBrandingSnapshot {
  businessName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  footerNote?: string | null;
  upiId?: string | null;
  upiPayeeName?: string | null;
  upiQrUrl?: string | null;
  termsAndConditions?: string | null;
}

export type ServiceType =
  | 'WASH_FOLD'
  | 'WASH_IRON'
  | 'STEAM_IRON'
  | 'DRY_CLEAN'
  | 'HOME_LINEN'
  | 'SHOES'
  | 'ADD_ONS';

export type OrderStatus =
  | 'BOOKING_CONFIRMED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_PROCESSING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderType = 'INDIVIDUAL' | 'SUBSCRIPTION' | 'BOTH';

export interface OrderRecord {
  id: string;
  userId: string;
  orderType?: OrderType;
  /** e.g. WALK_IN for walk-in counter orders. */
  orderSource?: string | null;
  serviceType: ServiceType;
  serviceTypes: ServiceType[];
  addressId: string;
  pincode: string;
  pickupDate: string;
  timeWindow: string;
  estimatedWeightKg: number | null;
  actualWeightKg: number | null;
  status: OrderStatus;
  subscriptionId: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  pickedUpAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
}

/** Admin list row: order + customer name, address, branch, dates, bill total, invoice/payment timestamps. */
export interface AdminOrderListRow extends OrderRecord {
  customerName: string | null;
  customerAddress: string;
  branchName: string | null;
  deliveredDate: string | null;
  /** Final invoice total (paise) if paid; ACK total if picked up; null = show NA. */
  billTotalPaise: number | null;
  /** Subtotal for the shown bill (paise). */
  billSubtotalPaise: number | null;
  /** Tax for the shown bill (paise). */
  billTaxPaise: number | null;
  /** Discount for the shown bill (paise). */
  billDiscountPaise: number | null;
  /** Invoice type: Individual, Subscription, Zero, Both. */
  billTypeLabel?: string;
  /** When ACK invoice was issued (if any). */
  ackIssuedAt?: string | null;
  /** When Final invoice was issued (if any). */
  finalIssuedAt?: string | null;
  /** Payment failure reason (if payment status FAILED). */
  paymentFailureReason?: string | null;
}

export interface AdminOrdersResponse {
  data: AdminOrderListRow[];
  nextCursor: string | null;
}

export interface AdminOrdersFilters {
  status?: OrderStatus;
  pincode?: string;
  serviceType?: ServiceType;
  customerId?: string;
  branchId?: string;
  /** e.g. WALK_IN to list only walk-in orders. */
  orderSource?: string;
  /** Partial match on order id, customer name, or phone. */
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  /** When set with pickupDateTo, filter by pickup date only (dashboard scheduled pickups). */
  pickupDateFrom?: string;
  pickupDateTo?: string;
  limit?: number;
  cursor?: string;
}

export interface OrderAdminSummary {
  order: OrderRecord;
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  address: {
    id: string;
    label: string;
    addressLine: string;
    pincode: string;
    /** Optional Google Maps URL saved from the mobile app. */
    googleMapUrl?: string | null;
  };
  branch: { id: string; name: string; address: string; phone?: string | null; gstNumber?: string | null; panNumber?: string | null; footerNote?: string | null } | null;
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
  subscription: {
    id: string;
    planName: string;
    remainingPickups: number;
    maxPickups: number;
    usedKg: number;
    usedItemsCount: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    expiryDate: string;
    active: boolean;
  } | null;
  /** All active subscriptions for the customer; for multi-select on ACK. */
  activeSubscriptions: Array<{
    id: string;
    planName: string;
    remainingPickups: number;
    maxPickups: number;
    usedKg: number;
    usedItemsCount: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    expiryDate: string;
  }>;
  subscriptionUsage: {
    deductedPickups: number;
    deductedKg: number;
    deductedItemsCount: number;
  } | null;
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
    issuedAt: string | null;
    pdfUrl: string | null;
    /** ACK new subscription snapshot(s); single object or array. Used to show selected subscription summary. */
    newSubscriptionSnapshotJson?: unknown;
    /** Branding stored with this invoice (logo, address, PAN, GST) so any user sees same company branding. */
    brandingSnapshotJson?: InvoiceBrandingSnapshot | null;
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
  } | null;
}
