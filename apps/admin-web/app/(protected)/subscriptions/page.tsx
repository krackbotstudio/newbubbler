'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, isBranchScopedStaff } from '@/lib/auth';
import { useSubscriptionInvoices, type AdminSubscriptionInvoiceRow } from '@/hooks/useSubscriptionInvoices';
import { BranchFilter } from '@/components/shared/BranchFilter';
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
import { normalizeDateRangeDraft } from '@/lib/normalize-applied-date-range';
import { DateRangeFilterWithApply } from '@/components/shared/DateRangeFilterWithApply';
import { Badge } from '@/components/ui/badge';

export default function SubscriptionsPage() {
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = isBranchScopedStaff(role) && !!user?.branchId;
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() =>
    isBranchHead && user?.branchId ? [user.branchId] : [],
  );
  const [customerId, setCustomerId] = useState('');
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const limit = 50;

  useEffect(() => {
    if (isBranchHead && user?.branchId) setSelectedBranchIds([user.branchId]);
  }, [isBranchHead, user?.branchId]);

  const effectiveBranchId =
    isBranchHead ? (user?.branchId ?? undefined) : (selectedBranchIds.length === 1 ? selectedBranchIds[0] : undefined);

  const filters = {
    customerId: customerId.trim() || undefined,
    branchId: effectiveBranchId ?? undefined,
    dateFrom: appliedDateFrom || undefined,
    dateTo: appliedDateTo || undefined,
    limit,
    cursor,
  };

  const { data, isLoading, isFetching, error } = useSubscriptionInvoices(filters);

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
    (row: AdminSubscriptionInvoiceRow) => {
      router.push(`/subscriptions/${row.subscriptionId}`);
    },
    [router]
  );

  if (error) {
    return (
      <div>
        <p className="text-sm text-destructive">Failed to load subscription invoices.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subscription invoices (order ID). Confirm payment here, then you can issue the acknowledgement invoice for the first order linked to this subscription.
          </p>
        </div>
        <BranchFilter
          selectedBranchIds={selectedBranchIds}
          onChange={setSelectedBranchIds}
          compactLabel
          disabled={!!isBranchHead}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Filter by branch, customer ID or issued date range. Pick dates in any order, then Apply. Leave both empty
            and Apply for all.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Customer ID</label>
              <Input
                placeholder="User UUID"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setCursor(undefined);
                }}
                className="w-64"
              />
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription Order ID</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((row) => (
                    <TableRow
                      key={row.invoiceId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="font-mono text-xs">{row.code ?? row.subscriptionId.slice(0, 8) + '…'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.issuedAt ? formatDate(row.issuedAt) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.customerName ?? row.customerId}>
                        {row.customerName ?? row.customerPhone ?? row.customerId.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">{row.planName ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.paymentStatus === 'PAID' || row.paymentStatus === 'CAPTURED'
                              ? 'default'
                              : row.paymentStatus === 'DUE' || row.paymentStatus === 'PENDING'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {row.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data?.data?.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No subscription invoices found.</div>
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
