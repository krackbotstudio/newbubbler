'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

type OrderCategories = {
  online: number;
  walkin: number;
  subscription: number;
  cancelled: number;
};

export interface OrderCategoriesPieChartProps {
  isLoading: boolean;
  categories: OrderCategories | null | undefined;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function OrderCategoriesPieChart({ isLoading, categories }: OrderCategoriesPieChartProps) {
  const data = useMemo(() => {
    const c = categories ?? {
      online: 0,
      walkin: 0,
      subscription: 0,
      cancelled: 0,
    };

    const total = c.online + c.walkin + c.subscription + c.cancelled;
    return {
      total,
      rows: [
        { name: 'Online', value: c.online, fill: 'hsl(var(--chart-1))' },
        { name: 'Walk-in', value: c.walkin, fill: 'hsl(var(--chart-2))' },
        { name: 'Subscription', value: c.subscription, fill: 'hsl(var(--chart-3))' },
        { name: 'Cancelled', value: c.cancelled, fill: 'hsl(var(--chart-4))' },
      ],
    };
  }, [categories]);

  if (isLoading) {
    return <Skeleton className="h-[320px] w-full" />;
  }

  if (!data.total) {
    return (
      <EmptyState
        title="No orders in range"
        description="Try a different preset or date range."
      />
    );
  }

  const content = ({ active, payload }: any): ReactNode => {
    if (!active || !payload?.length) return null;

    const row = payload[0];
    const value = Number(row?.value ?? 0);
    const name = row?.name ?? '—';
    const percent = data.total ? (value / data.total) * 100 : 0;
    return (
      <div className="rounded-md border bg-background p-3 shadow-md">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm">Orders: {value}</p>
        <p className="text-sm text-muted-foreground">Share: {formatPct(percent)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground justify-end">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-1))]" />
          Online
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-2))]" />
          Walk-in
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-3))]" />
          Subscription
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-4))]" />
          Cancelled
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Tooltip content={content} />
          <Pie
            data={data.rows}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.rows.map((row) => (
              <Cell key={row.name} fill={row.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Total: {data.total}</span>
        <span>Hover for % and count</span>
      </div>
    </div>
  );
}

