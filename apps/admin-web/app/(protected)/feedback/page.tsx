'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBranches } from '@/hooks/useBranches';
import { useFeedbackList, useFeedbackRatingStats } from '@/hooks/useFeedback';
import { formatDateTime } from '@/lib/format';
import type { FeedbackStatus, FeedbackType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getStoredUser, isBranchFilterLocked, restrictBranchesForUser } from '@/lib/auth';
import { LockedBranchSelect } from '@/components/shared/LockedBranchSelect';
import { getApiError } from '@/lib/api';
import { normalizeDateRangeDraft } from '@/lib/normalize-applied-date-range';
import { DateRangeFilterWithApply } from '@/components/shared/DateRangeFilterWithApply';

const STATUS_OPTIONS: FeedbackStatus[] = ['NEW', 'REVIEWED', 'RESOLVED'];
const TYPE_OPTIONS: FeedbackType[] = ['ORDER', 'GENERAL'];

export default function FeedbackPage() {
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [rating, setRating] = useState<string>('');
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const user = useMemo(() => getStoredUser(), []);
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const effectiveScopedBranchId = branchLocked ? user?.branchId ?? null : null;
  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const branchOptions = useMemo(() => restrictBranchesForUser(branches, user), [branches, user]);
  const isPartialAdmin = user?.role === 'PARTIAL_ADMIN';
  const [branchId, setBranchId] = useState<string>('');
  const effectiveBranchId = effectiveScopedBranchId ?? (branchId || null);

  useEffect(() => {
    if (branchLocked || !isPartialAdmin || branchId) return;
    if (branchOptions.length > 0) setBranchId(branchOptions[0].id);
  }, [branchLocked, isPartialAdmin, branchId, branchOptions]);

  const filters = {
    type: type || undefined,
    status: (status || undefined) as FeedbackStatus | undefined,
    rating: rating ? parseInt(rating, 10) : undefined,
    dateFrom: appliedDateFrom || undefined,
    dateTo: appliedDateTo || undefined,
    branchId: effectiveBranchId ?? undefined,
    limit: 20,
    cursor,
  };

  const { data, isLoading, error } = useFeedbackList(filters);
  const statsType = (type || 'ORDER') as FeedbackType;
  const { data: ratingStats, isLoading: statsLoading } = useFeedbackRatingStats({
    type: statsType,
    status: (status || undefined) as FeedbackStatus | undefined,
    dateFrom: appliedDateFrom || undefined,
    dateTo: appliedDateTo || undefined,
    branchId: effectiveBranchId ?? undefined,
  });

  const handleApplyDateRange = useCallback(() => {
    const n = normalizeDateRangeDraft(dateFromDraft, dateToDraft);
    setDateFromDraft(n.dateFrom);
    setDateToDraft(n.dateTo);
    setAppliedDateFrom(n.dateFrom);
    setAppliedDateTo(n.dateTo);
    setCursor(undefined);
  }, [dateFromDraft, dateToDraft]);

  const handleLoadMore = () => {
    if (data?.nextCursor) setCursor(data.nextCursor);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Feedback</h1>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-nowrap items-end gap-4 overflow-x-auto pb-1 [&>div]:shrink-0">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              className="h-9 rounded border bg-background px-3 text-sm"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setCursor(undefined);
              }}
            >
              <option value="">All</option>
              {TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="h-9 rounded border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(undefined);
              }}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Branch</label>
            {branchLocked ? (
              <LockedBranchSelect branchId={user?.branchId} selectClassName="h-9 min-w-[200px]" />
            ) : (
              <select
                className="h-9 rounded border bg-background px-3 text-sm min-w-[200px]"
                value={effectiveBranchId ?? ''}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setCursor(undefined);
                }}
                disabled={branchesLoading}
              >
                {!isPartialAdmin && <option value="">All branches</option>}
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {branchLocked ? (
            <div className="text-xs text-muted-foreground mt-2 self-end">
              Showing feedback for your assigned branch only.
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rating</label>
            <Input
              type="number"
              min={1}
              max={5}
              placeholder="1-5"
              className="w-20"
              value={rating}
              onChange={(e) => {
                setRating(e.target.value);
                setCursor(undefined);
              }}
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rating summary</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Based on current filters (type/date/branch).
          </p>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : ratingStats ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-sm">
                  Overall average:{' '}
                  <span className="font-semibold">
                    {ratingStats.avgRating != null ? `${ratingStats.avgRating.toFixed(2)} / 5` : '—'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rated count: {ratingStats.totalRated}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((r) => (
                  <div key={r} className="rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{r} star</span>
                      <span className="ml-auto font-semibold">{ratingStats.ratingCounts[r as 1 | 2 | 3 | 4 | 5]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No rated feedback found.</div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>List</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive">{getApiError(error).message}</p>
          ) : null}
          {isLoading && <Skeleton className="h-48 w-full" />}
          {!isLoading && data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Feedback Given</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.customerName ?? '—'}</TableCell>
                      <TableCell>{row.orderId ?? '—'}</TableCell>
                      <TableCell>{row.customerPhone ?? '—'}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.rating ?? '—'}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.message ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.nextCursor && (
                <Button variant="outline" className="mt-4" onClick={handleLoadMore}>
                  Load more
                </Button>
              )}
              {data.data.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No feedback found.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
