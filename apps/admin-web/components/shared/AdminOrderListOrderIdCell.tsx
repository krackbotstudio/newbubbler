'use client';

import { cn } from '@/lib/utils';

/**
 * Narrow, wrapping order code (matches walk-in orders table). Full id in `title` for hover.
 */
export function AdminOrderListOrderIdCell({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block max-w-[4.75rem] font-mono text-[11px] font-semibold text-primary leading-snug break-all align-top',
        className
      )}
      title={id}
    >
      {id}
    </span>
  );
}
