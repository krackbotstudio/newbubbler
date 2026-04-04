import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/types';
import { cn } from '@/lib/utils';

const ORDER_STATUS_VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  BOOKING_CONFIRMED: 'secondary',
  PICKUP_SCHEDULED: 'default',
  PICKED_UP: 'default',
  IN_PROCESSING: 'default',
  READY: 'warning',
  OUT_FOR_DELIVERY: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  BOOKING_CONFIRMED: 'Confirmed',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  PICKED_UP: 'Picked up',
  IN_PROCESSING: 'In processing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Human-readable order status for messages and exports (not badge UI). */
export function getOrderStatusLabel(status: string): string {
  const s = status as OrderStatus;
  return ORDER_STATUS_LABEL[s] ?? status.replace(/_/g, ' ');
}

interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const s = status as OrderStatus;
  const variant = ORDER_STATUS_VARIANT[s] ?? 'outline';
  const label = ORDER_STATUS_LABEL[s] ?? status;
  return <Badge variant={variant} className={cn(className)}>{label}</Badge>;
}

const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CAPTURED: 'success',
  PAID: 'success',
  FAILED: 'destructive',
  DUE: 'secondary',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  CAPTURED: 'Paid',
  PAID: 'Paid',
  PENDING: 'Pending',
  DUE: 'Due',
  FAILED: 'Failed',
};

export function PaymentStatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = PAYMENT_STATUS_VARIANT[status] ?? 'outline';
  const label = PAYMENT_STATUS_LABEL[status] ?? status;
  return <Badge variant={variant} className={cn(className)}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status, className }: { status: string; className?: string }) {
  const variant =
    status === 'ISSUED' ? 'success' : status === 'DRAFT' ? 'secondary' : 'outline';
  return <Badge variant={variant} className={cn(className)}>{status}</Badge>;
}
