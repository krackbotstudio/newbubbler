'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, isBranchFilterLocked } from '@/lib/auth';
import { useDeleteOrder, useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, formatDate } from '@/lib/format';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { AdminOrderListOrderIdCell } from '@/components/shared/AdminOrderListOrderIdCell';
import type { AdminOrderListRow, OrderStatus } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import { normalizeDateRangeDraft } from '@/lib/normalize-applied-date-range';
import { DateRangeFilterWithApply } from '@/components/shared/DateRangeFilterWithApply';

const STATUS_OPTIONS: OrderStatus[] = [
  'BOOKING_CONFIRMED',
  'PICKED_UP',
  'IN_PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export default function WalkInOrdersPage() {
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const { data: branches = [] } = useBranches();
  const deleteOrder = useDeleteOrder();
  const isAdmin = user?.role === 'ADMIN';
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [branchId, setBranchId] = useState<string>('');
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [deleteDialogOrder, setDeleteDialogOrder] = useState<AdminOrderListRow | null>(null);
  const limit = 20;

  const effectiveBranchId = branchLocked ? (user?.branchId ?? branchId) : branchId;

  useEffect(() => {
    if (branchLocked && user?.branchId) setBranchId(user.branchId);
  }, [branchLocked, user?.branchId]);

  const filters = {
    orderSource: 'WALK_IN' as const,
    status: status || undefined,
    branchId: effectiveBranchId || undefined,
    dateFrom: appliedDateFrom || undefined,
    dateTo: appliedDateTo || undefined,
    limit,
    cursor,
  };

  const { data, isLoading, isFetching, error } = useOrders(filters);

  const handleApplyDateRange = useCallback(() => {
    const n = normalizeDateRangeDraft(dateFromDraft, dateToDraft);
    setDateFromDraft(n.dateFrom);
    setDateToDraft(n.dateTo);
    setAppliedDateFrom(n.dateFrom);
    setAppliedDateTo(n.dateTo);
    setCursor(undefined);
  }, [dateFromDraft, dateToDraft]);

  const handleNext = useCallback(() => {
    if (data?.nextCursor) setCursor(data.nextCursor);
  }, [data?.nextCursor]);

  const handlePrev = useCallback(() => {
    setCursor(undefined);
  }, []);

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/orders/${id}`);
    },
    [router]
  );

  if (error) {
    return (
      <div>
        <p className="text-sm text-destructive">Failed to load walk-in orders.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Walk-in orders</h1>
        <Button asChild>
          <Link href="/walk-in-orders/new">New walk-in order</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as OrderStatus | '');
                  setCursor(undefined);
                }}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              {branchLocked ? (
                <LockedBranchSelect branchId={user?.branchId} />
              ) : (
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setCursor(undefined);
                  }}
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
            <DateRangeFilterWithApply
              draftFrom={dateFromDraft}
              draftTo={dateToDraft}
              onDraftFromChange={setDateFromDraft}
              onDraftToChange={setDateToDraft}
              onApply={handleApplyDateRange}
              blockLabels={false}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Initiated</TableHead>
                    <TableHead>Pickup date</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((row: AdminOrderListRow) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(row.id)}
                    >
                      <TableCell className="align-top py-3">
                        <AdminOrderListOrderIdCell id={row.id} />
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate" title={row.customerName ?? row.userId}>
                        {row.customerName ?? row.userId.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.customerAddress}>
                        {row.customerAddress}
                      </TableCell>
                      <TableCell className="whitespace-nowrap" title={row.branchName ?? undefined}>
                        {row.branchName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell>{formatDate(row.pickupDate)}</TableCell>
                      <TableCell>{row.deliveredDate ? formatDate(row.deliveredDate) : '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <PaymentStatusBadge status={row.paymentStatus} />
                          <span className="text-xs text-muted-foreground">
                            {row.paymentStatus === 'CAPTURED' || row.paymentStatus === 'PAID'
                              ? '(Success)'
                              : row.paymentStatus === 'DUE' || row.paymentStatus === 'PENDING'
                                ? '(Pending)'
                                : row.paymentStatus === 'FAILED'
                                  ? '(Failed)'
                                  : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.billTotalPaise != null ? formatMoney(row.billTotalPaise) : 'NA'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialogOrder(row);
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data?.data?.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No walk-in orders found.</div>
              )}
              <div className="flex items-center justify-between border-t px-4 py-2 mt-2">
                <span className="text-sm text-muted-foreground">
                  {data?.data?.length ?? 0} rows
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!cursor || isFetching}
                    onClick={handlePrev}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data?.nextCursor || isFetching}
                    onClick={handleNext}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteDialogOrder} onOpenChange={(open) => !open && setDeleteDialogOrder(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Delete walk-in order permanently</DialogTitle>
            <DialogDescription>
              This action is irreversible. The order and all related records will be deleted permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Warning: This will permanently delete order {deleteDialogOrder?.id}.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteDialogOrder || deleteOrder.isPending}
              onClick={() => {
                if (!deleteDialogOrder) return;
                deleteOrder.mutate(deleteDialogOrder.id, {
                  onSuccess: () => {
                    toast.success('Order deleted permanently');
                    setDeleteDialogOrder(null);
                  },
                  onError: (e) => toast.error(getFriendlyErrorMessage(e)),
                });
              }}
            >
              {deleteOrder.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
