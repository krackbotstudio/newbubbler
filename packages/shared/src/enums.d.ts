export declare enum ServiceType {
    WASH_FOLD = "WASH_FOLD",
    WASH_IRON = "WASH_IRON",
    STEAM_IRON = "STEAM_IRON",
    DRY_CLEAN = "DRY_CLEAN",
    HOME_LINEN = "HOME_LINEN",
    SHOES = "SHOES",
    ADD_ONS = "ADD_ONS"
}
export declare enum Segment {
    MEN = "MEN",
    WOMEN = "WOMEN",
    KIDS = "KIDS",
    HOME_LINEN = "HOME_LINEN"
}
export declare enum OrderStatus {
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED",
    PICKUP_SCHEDULED = "PICKUP_SCHEDULED",
    PICKED_UP = "PICKED_UP",
    IN_PROCESSING = "IN_PROCESSING",
    READY = "READY",
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED"
}
export declare enum OrderType {
    INDIVIDUAL = "INDIVIDUAL",
    SUBSCRIPTION = "SUBSCRIPTION",
    /** Laundry items + subscription (new or existing); subscription assigned at ACK by admin. */
    BOTH = "BOTH"
}
export declare enum Role {
    CUSTOMER = "CUSTOMER",
    ADMIN = "ADMIN",
    OPS = "OPS",
    AGENT = "AGENT",
    BILLING = "BILLING"
}
export declare enum PaymentProvider {
    RAZORPAY = "RAZORPAY",
    CASH = "CASH",
    UPI = "UPI",
    CARD = "CARD",
    NONE = "NONE"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    CAPTURED = "CAPTURED",
    FAILED = "FAILED"
}
export declare enum InvoiceOrderMode {
    INDIVIDUAL = "INDIVIDUAL",
    SUBSCRIPTION_ONLY = "SUBSCRIPTION_ONLY",
    BOTH = "BOTH"
}
export declare enum InvoiceType {
    ACKNOWLEDGEMENT = "ACKNOWLEDGEMENT",
    FINAL = "FINAL",
    SUBSCRIPTION = "SUBSCRIPTION"
}
export declare enum InvoiceStatus {
    DRAFT = "DRAFT",
    ISSUED = "ISSUED",
    VOID = "VOID"
}
export declare enum SubscriptionVariant {
    SINGLE = "SINGLE",
    COUPLE = "COUPLE",
    FAMILY = "FAMILY"
}
export declare enum RedemptionMode {
    MULTI_USE = "MULTI_USE",
    SINGLE_USE = "SINGLE_USE"
}
export declare enum InvoiceItemType {
    SERVICE = "SERVICE",
    DRYCLEAN_ITEM = "DRYCLEAN_ITEM",
    ADDON = "ADDON",
    FEE = "FEE",
    DISCOUNT = "DISCOUNT"
}
export declare enum FeedbackType {
    ORDER = "ORDER",
    GENERAL = "GENERAL"
}
export declare enum FeedbackStatus {
    NEW = "NEW",
    REVIEWED = "REVIEWED",
    RESOLVED = "RESOLVED"
}
