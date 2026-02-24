'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import { useOrders } from '@/hooks/useOrders';
import { useBranches } from '@/hooks/useBranches';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatMoney, formatDate } from '@/lib/format';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import type { AdminOrderListRow, OrderStatus, ServiceType } from '@/types';

const STATUS_OPTIONS: OrderStatus[] = [
  'BOOKING_CONFIRMED',
  'PICKED_UP',
  'IN_PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const SERVICE_OPTIONS: ServiceType[] = [
  'WASH_FOLD',
  'WASH_IRON',
  'STEAM_IRON',
  'DRY_CLEAN',
  'HOME_LINEN',
  'SHOES',
  'ADD_ONS',
];

export default function OrdersPage() {
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const isBranchHead = user?.role === 'OPS' && user?.branchId;
  const { data: branches = [] } = useBranches();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [pincode, setPincode] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType | ''>('');
  const [branchId, setBranchId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const limit = 20;

  const effectiveBranchId = isBranchHead ? (user?.branchId ?? branchId) : branchId;

  useEffect(() => {
    if (isBranchHead && user?.branchId) setBranchId(user.branchId);
  }, [isBranchHead, user?.branchId]);

  const filters = {
    status: status || undefined,
    pincode: pincode || undefined,
    serviceType: serviceType || undefined,
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
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Date filter: leave empty for all dates. With a range, orders are shown if initiated, picked up, or delivered on any day in that range.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground block">Status</label>
              <select
                className="h-10 min-h-[2.5rem] w-full min-w-[100px]"
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
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground block">Pincode</label>
              <Input
                placeholder="6 digits"
                value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value);
                  setCursor(undefined);
                }}
                maxLength={6}
                className="w-28"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs text-muted-foreground block">Service</label>
              <select
                className="h-10 min-h-[2.5rem] w-full min-w-[100px]"
                value={serviceType}
                onChange={(e) => {
                  setServiceType(e.target.value as ServiceType | '');
                  setCursor(undefined);
                }}
              >
                <option value="">All</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
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
              <label className="text-xs text-muted-foreground block">Branch name</label>
              {isBranchHead ? (
                <select
                  className="h-10 min-h-[2.5rem] min-w-[140px] disabled:opacity-70"
                  value={effectiveBranchId}
                  disabled
                  title="Your assigned branch (cannot change)"
                >
                  <option value={user?.branchId ?? ''}>
                    {branches.find((b) => b.id === user?.branchId)?.name ?? user?.branchId ?? '—'}
                  </option>
                </select>
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
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
                    <TableHead>Branch name</TableHead>
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
                      <TableCell className="font-mono text-xs break-all" title={row.id}>{row.id}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={row.customerName ?? row.userId}>
                        {row.customerName ?? row.userId.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.customerAddress}>
                        {row.customerAddress}
                      </TableCell>
                      <TableCell className="whitespace-nowrap" title={row.branchName ?? undefined}>
                        {row.branchName ?? '—'}
                      </TableCell>
                      <TableCell>{row.serviceType.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell>{formatDate(row.pickupDate)}</TableCell>
                      <TableCell>{row.deliveredDate ? formatDate(row.deliveredDate) : '—'}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={row.paymentStatus} />
                        <span className="ml-1 text-xs text-muted-foreground">
                          {row.paymentStatus === 'CAPTURED' ? '(Success)' : row.paymentStatus === 'DUE' || row.paymentStatus === 'PENDING' ? '(Pending)' : '(Failed)'}
                        </span>
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
              <div className="flex items-center justify-between border-t px-4 py-2">
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
