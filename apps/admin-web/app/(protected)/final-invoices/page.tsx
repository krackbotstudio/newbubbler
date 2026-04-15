'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, isBranchScopedStaff } from '@/lib/auth';
import { useFinalInvoices, type AdminFinalInvoiceRow } from '@/hooks/useFinalInvoices';
import { useBranches } from '@/hooks/useBranches';
import { useWalkInLookupCustomer } from '@/hooks/useWalkIn';
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
import { normalizeDateRangeDraft } from '@/lib/normalize-applied-date-range';
import { DateRangeFilterWithApply } from '@/components/shared/DateRangeFilterWithApply';
import { Badge } from '@/components/ui/badge';

export default function FinalInvoicesPage() {
  const router = useRouter();
  const user = useMemo(() => getStoredUser(), []);
  const isBranchHead = user && isBranchScopedStaff(user.role) && user.branchId;
  const { data: branches = [] } = useBranches();
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');
  const combinedPhone = useMemo(
    () =>
      (countryCode.trim().startsWith('+') ? countryCode.trim() : '+' + countryCode.trim()) +
      phoneDigits.replace(/\D/g, '').slice(0, 10),
    [countryCode, phoneDigits]
  );
  const { data: customerByPhone } = useWalkInLookupCustomer(combinedPhone);
  const [branchId, setBranchId] = useState('');
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const limit = 50;

  const effectiveBranchId = isBranchHead ? (user?.branchId ?? branchId) : branchId;
  const resolvedCustomerId = phoneDigits.replace(/\D/g, '').length >= 10 ? customerByPhone?.id : undefined;

  useEffect(() => {
    if (isBranchHead && user?.branchId) setBranchId(user.branchId);
  }, [isBranchHead, user?.branchId]);

  const filters = {
    customerId: resolvedCustomerId ?? undefined,
    branchId: effectiveBranchId || undefined,
    dateFrom: appliedDateFrom || undefined,
    dateTo: appliedDateTo || undefined,
    limit,
    cursor,
  };

  const { data, isLoading, isFetching, error } = useFinalInvoices(filters);

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
    (row: AdminFinalInvoiceRow) => {
      if (row.type === 'SUBSCRIPTION' && row.subscriptionId) {
        router.push(`/subscription-invoice/${row.subscriptionId}`);
      } else if (row.orderId) {
        router.push(`/orders/${row.orderId}`);
      }
    },
    [router]
  );

  if (error) {
    return (
      <div>
        <p className="text-sm text-destructive">Failed to load final invoices.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Final Invoices</h1>
      <p className="text-sm text-muted-foreground">
        All final invoices (order and subscription) with payment collected. Includes zero-value invoices. Use date
        filters in any order, then Apply.
      </p>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Customer phone</label>
              <div className="flex gap-1">
                <Input
                  type="tel"
                  placeholder="+91"
                  value={countryCode}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setCountryCode(d ? '+' + d : '+91');
                    setCursor(undefined);
                  }}
                  className="w-16 shrink-0"
                />
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={phoneDigits}
                  onChange={(e) => {
                    setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setCursor(undefined);
                  }}
                  className="w-36"
                  maxLength={10}
                />
              </div>
            </div>
            <DateRangeFilterWithApply
              draftFrom={dateFromDraft}
              draftTo={dateToDraft}
              onDraftFromChange={setDateFromDraft}
              onDraftToChange={setDateToDraft}
              onApply={handleApplyDateRange}
              blockLabels={false}
            />
            <div className="space-y-1 ml-auto">
              <label className="text-xs text-muted-foreground">Branch name</label>
              {isBranchHead ? (
                <select
                  className="h-10 rounded-md border border-input bg-muted px-3 text-sm min-w-[140px]"
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
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setCursor(undefined);
                  }}
                  title="Filter final invoices by branch name"
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
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issued</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Branch name</TableHead>
                    <TableHead>Plan / Order</TableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {row.issuedAt ? formatDate(row.issuedAt) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.type === 'SUBSCRIPTION' ? 'secondary' : 'default'}>
                          {row.type === 'SUBSCRIPTION' ? 'Subscription' : row.orderSource === 'WALK_IN' ? 'Walk in' : 'Online'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.code ?? '—'}</TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.customerName ?? row.customerId}>
                        {row.customerName ?? row.customerPhone ?? row.customerId.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.branchName ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">
                        {row.type === 'SUBSCRIPTION' ? (row.planName ?? '—') : (row.orderId ? `Order ${row.orderId.slice(0, 8)}…` : '—')}
                      </TableCell>
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
                <div className="p-8 text-center text-muted-foreground">No final invoices found.</div>
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
