'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, isBranchFilterLocked } from '@/lib/auth';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { useDebounce } from '@/hooks/useDebounce';
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
import type { AdminOrderListRow } from '@/types';

export default function OrdersPage() {
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const { data: branches = [] } = useBranches();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput.trim(), 400);
  const [branchId, setBranchId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const limit = 20;

  const effectiveBranchId = branchLocked ? (user?.branchId ?? branchId) : branchId;

  useEffect(() => {
    if (branchLocked && user?.branchId) setBranchId(user.branchId);
  }, [branchLocked, user?.branchId]);

  const filters = {
    search: debouncedSearch || undefined,
    branchId: effectiveBranchId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
    cursor,
  };

  const { data, isLoading, isFetching, error } = useOrders(filters);

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
        <p className="text-sm text-destructive">Failed to load orders.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Date filter: leave empty for all dates. With a range, orders are shown if initiated, picked up, or delivered on any day in that range.
          </p>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="space-y-1.5 min-w-0 flex-1 basis-[min(100%,280px)]">
              <label className="text-xs text-muted-foreground block">Search</label>
              <Input
                placeholder="Order ID, customer name, or mobile"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setCursor(undefined);
                }}
                className="min-w-0 w-full max-w-md"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground block">Date from</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCursor(undefined);
                }}
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground block">Date to</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCursor(undefined);
                }}
              />
            </div>
            <div className="space-y-1.5 ml-auto min-w-0">
              <label className="text-xs text-muted-foreground block">Branch</label>
              {branchLocked ? (
                <LockedBranchSelect branchId={user?.branchId} selectClassName="min-w-[140px]" />
              ) : (
                <select
                  className="h-10 min-h-[2.5rem] min-w-[140px]"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setCursor(undefined);
                  }}
                  title="Filter orders by branch name"
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
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Initiated</TableHead>
                    <TableHead>Pickup date</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Bill type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
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
                      <TableCell className="text-xs uppercase tracking-wide">
                        {row.serviceType.replace(/_/g, ' ')}
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
                      <TableCell className="text-muted-foreground text-sm">
                        {row.billTypeLabel ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.billTotalPaise != null ? formatMoney(row.billTotalPaise) : 'NA'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data?.data?.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No orders found.</div>
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
    </div>
  );
}
