export enum ServiceType {
  WASH_FOLD = 'WASH_FOLD',
  WASH_IRON = 'WASH_IRON',
  STEAM_IRON = 'STEAM_IRON',
  DRY_CLEAN = 'DRY_CLEAN',
  HOME_LINEN = 'HOME_LINEN',
  SHOES = 'SHOES',
  ADD_ONS = 'ADD_ONS',
}

export enum Segment {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  HOME_LINEN = 'HOME_LINEN',
}

export enum OrderStatus {
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',
  PICKED_UP = 'PICKED_UP',
  IN_PROCESSING = 'IN_PROCESSING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  INDIVIDUAL = 'INDIVIDUAL',
  SUBSCRIPTION = 'SUBSCRIPTION',
  /** Laundry items + subscription (new or existing); subscription assigned at ACK by admin. */
  BOTH = 'BOTH',
}

export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  PARTIAL_ADMIN = 'PARTIAL_ADMIN',
  OPS = 'OPS',
  /** Branch-scoped staff: dashboard, orders, walk-in, customers, feedback only (admin-web). */
  AGENT = 'AGENT',
  BILLING = 'BILLING',
}

export enum PaymentProvider {
  RAZORPAY = 'RAZORPAY',
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  NONE = 'NONE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
}

export enum InvoiceOrderMode {
  INDIVIDUAL = 'INDIVIDUAL',
  SUBSCRIPTION_ONLY = 'SUBSCRIPTION_ONLY',
  BOTH = 'BOTH',
}

export enum InvoiceType {
  ACKNOWLEDGEMENT = 'ACKNOWLEDGEMENT',
  FINAL = 'FINAL',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  VOID = 'VOID',
}

export enum SubscriptionVariant {
  SINGLE = 'SINGLE',
  COUPLE = 'COUPLE',
  FAMILY = 'FAMILY',
}

export enum RedemptionMode {
  MULTI_USE = 'MULTI_USE',
  SINGLE_USE = 'SINGLE_USE',
}

export enum InvoiceItemType {
  SERVICE = 'SERVICE',
  DRYCLEAN_ITEM = 'DRYCLEAN_ITEM',
  ADDON = 'ADDON',
  FEE = 'FEE',
  DISCOUNT = 'DISCOUNT',
}

export enum FeedbackType {
  ORDER = 'ORDER',
  GENERAL = 'GENERAL',
}

export enum FeedbackStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
}

