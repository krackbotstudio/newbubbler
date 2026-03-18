'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format';
import type { AnalyticsTotals } from '@/types';

export interface RevenueKpisProps {
  totals: AnalyticsTotals | null;
  isLoading: boolean;
}

function pendingPaise(totals: AnalyticsTotals): number {
  return Math.max(0, totals.billedPaise - totals.collectedPaise);
}

export function RevenueKpis({ totals, isLoading }: RevenueKpisProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!totals) {
    return null;
  }

  const pending = pendingPaise(totals);

  const kpis = [
    { label: 'Collected Revenue', value: formatMoney(totals.collectedPaise) },
    { label: 'Billed Revenue', value: formatMoney(totals.billedPaise) },
    { label: 'Tax collected', value: formatMoney(totals.taxPaise) },
    { label: 'Discount given', value: formatMoney(totals.discountPaise) },
    { label: 'Orders', value: String(totals.ordersCount) },
    { label: 'Invoices', value: String(totals.invoicesCount) },
    { label: 'Pending', value: formatMoney(pending) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{k.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
