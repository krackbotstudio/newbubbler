'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/format';
import type { CustomerListRow } from '@/types';
import { Eye } from 'lucide-react';

const NOTES_MAX = 60;

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '—';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export interface CustomersTableProps {
  data: CustomerListRow[];
  isLoading: boolean;
  onRowClick: (userId: string) => void;
  /** Hide subscription count columns (e.g. branch head / no subscription workflow). */
  hideSubscriptionColumns?: boolean;
  /** Override default empty copy when there are no rows. */
  emptyDescription?: string;
}

export function CustomersTable({
  data,
  isLoading,
  onRowClick,
  hideSubscriptionColumns = false,
  emptyDescription,
}: CustomersTableProps) {
  const handleView = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    onRowClick(userId);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <EmptyState
        title="No customers found"
        description={
          emptyDescription ?? 'Try a different search or clear the filter.'
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead className="text-right">Past orders</TableHead>
          <TableHead className="text-right">Active orders</TableHead>
          <TableHead className="text-right">Total orders</TableHead>
          {!hideSubscriptionColumns ? (
            <>
              <TableHead className="text-right">Active subscriptions</TableHead>
              <TableHead className="text-right">Inactive subscriptions</TableHead>
            </>
          ) : null}
          <TableHead>Created</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onRowClick(row.id)}
          >
            <TableCell className="font-medium">{row.name ?? '—'}</TableCell>
            <TableCell>{row.phone ?? '—'}</TableCell>
            <TableCell>{row.email ?? '—'}</TableCell>
            <TableCell className="text-right">{row.pastOrdersCount ?? 0}</TableCell>
            <TableCell className="text-right">{row.activeOrdersCount ?? 0}</TableCell>
            <TableCell className="text-right">
              {(row.pastOrdersCount ?? 0) + (row.activeOrdersCount ?? 0)}
            </TableCell>
            {!hideSubscriptionColumns ? (
              <>
                <TableCell className="text-right">{row.activeSubscriptionsCount ?? 0}</TableCell>
                <TableCell className="text-right">{row.inactiveSubscriptionsCount ?? 0}</TableCell>
              </>
            ) : null}
            <TableCell>{formatDate(row.createdAt)}</TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={(e) => handleView(e, row.id)} title="Open profile">
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
