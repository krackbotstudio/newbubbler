import { OrderStatus } from '@shared/enums';

/**
 * Allowed order status transitions. Source of truth for domain rule.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.BOOKING_CONFIRMED]: ['PICKED_UP' as OrderStatus, 'CANCELLED' as OrderStatus],
  [OrderStatus.PICKUP_SCHEDULED]: ['PICKED_UP' as OrderStatus, 'CANCELLED' as OrderStatus],
  [OrderStatus.PICKED_UP]: ['IN_PROCESSING' as OrderStatus],
  [OrderStatus.IN_PROCESSING]: ['READY' as OrderStatus],
  [OrderStatus.READY]: ['OUT_FOR_DELIVERY' as OrderStatus],
  [OrderStatus.OUT_FOR_DELIVERY]: ['DELIVERED' as OrderStatus],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function isAllowedTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
