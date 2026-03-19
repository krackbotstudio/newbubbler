/* eslint-disable react/no-array-index-key */
'use client';

import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, formatDateTime } from '@/lib/format';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import type { AdminOrderListRow } from '@/types';
import { api } from '@/lib/api';
import type { OrderAdminSummary } from '@/types';

export interface AnalyticsOrdersListProps {
  orders: AdminOrderListRow[];
  isLoading: boolean;
  errorMessage?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function AnalyticsOrdersList({
  orders,
  isLoading,
  errorMessage,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: AnalyticsOrdersListProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, OrderAdminSummary>>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<Record<string, string>>({});

  const toggleExpanded = async (id: string) => {
    const willOpen = expandedOrderId !== id;
    setExpandedOrderId(willOpen ? id : null);

    if (!willOpen) return;
    if (summaries[id]) return;

    setLoadingSummaryId(id);
    setSummaryError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await api.get<OrderAdminSummary>(`/admin/orders/${id}/summary`);
      setSummaries((prev) => ({ ...prev, [id]: res.data }));
    } catch (e) {
      setSummaryError((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Failed to load order bill details',
      }));
    } finally {
      setLoadingSummaryId((cur) => (cur === id ? null : cur));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <EmptyState
        title="Failed to load orders"
        description={errorMessage}
      />
    );
  }

  if (!orders.length) {
    return <EmptyState title="No orders found" description="Try a different branch or date range." />;
  }

  return (
    <div className="space-y-4">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bill</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Invoices</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const isOpen = expandedOrderId === o.id;
            const isLoadingThis = loadingSummaryId === o.id;
            const invSummary = summaries[o.id];
            const err = summaryError[o.id];
            return (
              <Fragment key={o.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>#{o.id}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(o.id)}
                      >
                        {isOpen ? 'Hide bill' : 'View bill'}
                      </Button>
                      <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                        Sub: {o.billSubtotalPaise != null ? formatMoney(o.billSubtotalPaise) : '—'} · Tax:{' '}
                        {o.billTaxPaise != null ? formatMoney(o.billTaxPaise) : '—'} · Disc:{' '}
                        {o.billDiscountPaise != null ? formatMoney(o.billDiscountPaise) : '—'}
                      </span>
                    </div>
                  </TableCell>
              <TableCell>
                <OrderStatusBadge status={o.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{o.billTypeLabel ?? '—'}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {o.billTotalPaise != null ? formatMoney(o.billTotalPaise) : '—'}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">ACK:</span>{' '}
                    {o.ackIssuedAt ? formatDateTime(o.ackIssuedAt) : '—'}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Final:</span>{' '}
                    {o.finalIssuedAt ? formatDateTime(o.finalIssuedAt) : '—'}
                  </div>
                </div>
                {o.paymentFailureReason ? (
                  <div className="text-xs text-destructive mt-1">
                    {o.paymentFailureReason}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge
                  status={(o as { paymentStatus?: string }).paymentStatus ?? 'PENDING'}
                />
              </TableCell>
                </TableRow>
                {isOpen ? (
                  <TableRow>
                    <TableCell colSpan={6} className="!py-3">
                      {isLoadingThis ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                          ))}
                        </div>
                      ) : err ? (
                        <EmptyState title="Failed to load bill" description={err} />
                      ) : !invSummary ? (
                        <EmptyState title="No bill details" description="Try again." />
                      ) : (
                        (() => {
                          const finalInv = invSummary.invoices.find((inv) => inv.type === 'FINAL');
                          const ackInv = invSummary.invoices.find((inv) => inv.type === 'ACKNOWLEDGEMENT');
                          const invoiceToShow = finalInv ?? ackInv ?? null;
                          if (!invoiceToShow) return <EmptyState title="No invoice found" description="No items available." />;
                          const items = invoiceToShow.items ?? [];
                          const segmentServiceItems = items.filter((it) => it.segmentCategoryId && it.serviceCategoryId);

                          return (
                            <div className="space-y-3">
                              <div>
                                <div className="text-sm font-medium mb-2">Items</div>
                                {segmentServiceItems.length === 0 ? (
                                  <EmptyState
                                    title="No segment/service items"
                                    description="This bill has no line items with Segment & Service."
                                  />
                                ) : (
                                  <Table className="w-full">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Segment</TableHead>
                                        <TableHead>Service</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {segmentServiceItems.map((it) => (
                                        <TableRow
                                          key={
                                            String(it.segmentCategoryId) +
                                            '|' +
                                            String(it.serviceCategoryId) +
                                            '|' +
                                            String(it.quantity) +
                                            '|' +
                                            String(it.name)
                                          }
                                        >
                                          <TableCell className="whitespace-nowrap">{it.name ?? '—'}</TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            {it.segmentLabel ?? it.segmentCategoryId}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                            {it.serviceLabel ?? it.serviceCategoryId}
                                          </TableCell>
                                          <TableCell className="text-right whitespace-nowrap">{it.quantity}</TableCell>
                                          <TableCell className="text-right whitespace-nowrap">{formatMoney(it.amount)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {onLoadMore && hasMore ? (
        <Button
          variant="outline"
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  );
}

