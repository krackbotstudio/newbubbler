'use client';

import { type Role } from '@/lib/auth';
import {
  canAccessCatalogEdit,
  canAccessPaymentEdit,
  canAccessOrders,
  canAccessBrandingEdit,
  canAccessCustomersEdit,
} from '@/lib/auth';

export type Gate = 'orders' | 'catalogEdit' | 'paymentEdit' | 'brandingEdit' | 'customersEdit';

const GATES: Record<Gate, (role: Role, branchId?: string | null) => boolean> = {
  orders: (r) => canAccessOrders(r),
  catalogEdit: (r, b) => canAccessCatalogEdit(r, b),
  paymentEdit: (r) => canAccessPaymentEdit(r),
  brandingEdit: (r) => canAccessBrandingEdit(r),
  customersEdit: (r) => canAccessCustomersEdit(r),
};

interface RoleGateProps {
  role: Role;
  gate: Gate;
  /** Required for `catalogEdit` when role is OPS (branch head). */
  branchId?: string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ role, gate, branchId, children, fallback = null }: RoleGateProps) {
  const allowed = GATES[gate](role, branchId);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
