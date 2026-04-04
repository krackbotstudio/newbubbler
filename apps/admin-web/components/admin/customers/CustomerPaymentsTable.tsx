'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerPayments } from '@/hooks/useCustomers';
import { useBranches } from '@/hooks/useBranches';
import { PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import type { CustomerPaymentRow } from '@/hooks/useCustomers';
import { isBranchFilterLocked, type Role } from '@/lib/auth';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { Eye } from 'lucide-react';

export interface CustomerPaymentsTableProps {
  userId: string;
  role?: Role;
  userBranchId?: string | null;
}

export function CustomerPaymentsTable({ userId, role, userBranchId }: CustomerPaymentsTableProps) {
  const router = useRouter();
  const branchLocked = !!role && isBranchFilterLocked(role, userBranchId);
  const [branchIdFilter, setBranchIdFilter] = useState<string>(() => (branchLocked ? userBranchId ?? '' : ''));
  const effectiveBranchId = branchLocked ? (userBranchId ?? '') : branchIdFilter;
  const { data: branches = [] } = useBranches();
  const { data: payments, isLoading, error } = useCustomerPayments(userId, effectiveBranchId || undefined);

  const handleView = (p: CustomerPaymentRow) => {
    if (p.type === 'order' && p.orderId) router.push(`/orders/${p.orderId}`);
    else if (p.type === 'subscription' && p.subscriptionId) router.push(`/subscription-invoice/${p.subscriptionId}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4">
        <CardTitle>Previous payments</CardTitle>
        <div className="flex items-center gap-2">
          <label htmlFor="payments-branch-filter" className="text-sm text-muted-foreground whitespace-nowrap">
            Branch
          </label>
          {branchLocked ? (
            <LockedBranchSelect branchId={userBranchId} selectClassName="h-9 min-w-[160px]" />
          ) : (
            <select
              id="payments-branch-filter"
              className="h-9 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm"
              value={effectiveBranchId}
              onChange={(e) => setBranchIdFilter(e.target.value)}
              title="Filter by branch"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.id}
                </option>
              ))}
            </select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive mb-4">
            Failed to load payments: {(error as Error).message}
          </p>
        ) : null}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !payments?.length ? (
          <EmptyState
            title="No payments"
            description="This customer has no payment records yet."
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p: CustomerPaymentRow) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {p.orderId ? `${p.orderId.slice(0, 8)}…` : p.subscriptionId ? `${p.subscriptionId.slice(0, 8)}…` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {(p.branchName ?? p.branchId) ?? '—'}
                  </TableCell>
                  <TableCell className="capitalize">{p.type}</TableCell>
                  <TableCell>₹{(p.amount / 100).toFixed(0)}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                    {p.failureReason && (
                      <span className="block text-xs text-destructive mt-0.5" title={p.failureReason}>
                        {p.failureReason.slice(0, 25)}…
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{p.provider}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(p)}
                      title={p.type === 'subscription' ? 'View invoice' : 'View order'}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
